#!/usr/bin/env python3
"""Place each catalog print inside the leaning-frame mockup.

The mockup opening is a fixed A-series portrait. This script scales only the
middle of the frame (keeping the floor, rails, and width) so the opening
matches each print's aspect ratio, then composites without cropping.
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "posters.json"
OUT_DIR = ROOT / "images" / "framed"
MOCKUP_PATH = ROOT / "images" / "mockups" / "leaning-frame.png"
MAT_SEED = (512, 850)
PAPER = (225, 221, 220)
SLICE_INSET = 0.12
HEIGHT_SCALE_MIN = 0.45
HEIGHT_SCALE_MAX = 1.6
SKIP_SLICE_EPSILON = 0.02


def find_coeffs(source, target):
    matrix = []
    for s, t in zip(source, target):
        matrix.append([t[0], t[1], 1, 0, 0, 0, -s[0] * t[0], -s[0] * t[1]])
        matrix.append([0, 0, 0, t[0], t[1], 1, -s[1] * t[0], -s[1] * t[1]])
    a = np.array(matrix, dtype=np.float64)
    b = np.array(source, dtype=np.float64).reshape(8)
    return np.linalg.lstsq(a, b, rcond=None)[0]


def as_rgb(im: Image.Image) -> Image.Image:
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def paper_mask(mockup: Image.Image, seed: tuple[int, int] = MAT_SEED) -> Image.Image:
    arr = np.array(mockup.convert("RGB"))
    h, w = arr.shape[:2]
    sx, sy = seed
    sx = min(max(0, sx), w - 1)
    sy = min(max(0, sy), h - 1)
    target = np.array(PAPER, dtype=np.int16)
    ok = np.abs(arr.astype(np.int16) - target).max(axis=2) <= 6
    if not ok[sy, sx]:
        ys, xs = np.where(ok)
        if len(xs) == 0:
            raise RuntimeError("Could not find mat/paper pixels in mockup")
        d = (xs - sx) ** 2 + (ys - sy) ** 2
        i = int(np.argmin(d))
        sx, sy = int(xs[i]), int(ys[i])

    ring = np.zeros((h, w), dtype=bool)
    q = deque([(sx, sy)])
    ring[sy, sx] = True
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not ring[ny, nx] and ok[ny, nx]:
                ring[ny, nx] = True
                q.append((nx, ny))

    outside = ~ring
    border = np.zeros_like(outside)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if outside[y, x]:
                border[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if outside[y, x] and not border[y, x]:
                border[y, x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and outside[ny, nx] and not border[ny, nx]:
                border[ny, nx] = True
                q.append((nx, ny))

    mask = Image.fromarray(((~border).astype(np.uint8) * 255), "L")
    mask = mask.filter(ImageFilter.MaxFilter(5))
    return mask.filter(ImageFilter.GaussianBlur(radius=0.6))


def paper_corners(mask: Image.Image) -> np.ndarray:
    paper = np.array(mask) > 128
    ys, xs = np.where(paper)
    pts = np.stack([xs, ys], axis=1).astype(np.float64)
    s = pts[:, 0] + pts[:, 1]
    d = pts[:, 0] - pts[:, 1]
    return np.array(
        [
            pts[np.argmin(s)],
            pts[np.argmax(d)],
            pts[np.argmax(s)],
            pts[np.argmin(d)],
        ]
    )


def opening_size(corners: np.ndarray) -> tuple[float, float]:
    avg_w = (
        np.linalg.norm(corners[1] - corners[0]) + np.linalg.norm(corners[2] - corners[3])
    ) / 2
    avg_h = (
        np.linalg.norm(corners[3] - corners[0]) + np.linalg.norm(corners[2] - corners[1])
    ) / 2
    return float(avg_w), float(avg_h)


def slice_lines(corners: np.ndarray) -> tuple[int, int]:
    top = float(min(corners[0, 1], corners[1, 1]))
    bottom = float(max(corners[2, 1], corners[3, 1]))
    height = max(1.0, bottom - top)
    cut_top = int(round(top + height * SLICE_INSET))
    cut_bottom = int(round(bottom - height * SLICE_INSET))
    if cut_bottom - cut_top < 32:
        mid = int(round((top + bottom) / 2))
        cut_top = mid - 16
        cut_bottom = mid + 16
    return cut_top, cut_bottom


def map_y(
    y: float,
    wall_end: int,
    cut_top: int,
    cut_bottom: int,
    mid_scale: float,
    new_wall_h: int,
) -> float:
    if y <= wall_end:
        return y * (new_wall_h / max(wall_end, 1))
    if y <= cut_top:
        return new_wall_h + (y - wall_end)
    if y <= cut_bottom:
        return new_wall_h + (cut_top - wall_end) + (y - cut_top) * mid_scale
    return (
        new_wall_h
        + (cut_top - wall_end)
        + (cut_bottom - cut_top) * mid_scale
        + (y - cut_bottom)
    )


def scale_frame_height(
    mockup: Image.Image, corners: np.ndarray, art_ratio: float
) -> tuple[Image.Image, tuple[int, int]]:
    """Compress or stretch the middle of the frame so the opening matches art_ratio."""
    avg_w, avg_h = opening_size(corners)
    target_h = avg_w / max(art_ratio, 0.05)
    height_scale = float(np.clip(target_h / avg_h, HEIGHT_SCALE_MIN, HEIGHT_SCALE_MAX))
    seed = MAT_SEED
    if abs(height_scale - 1) < SKIP_SLICE_EPSILON:
        return mockup, seed

    inner_top = float(min(corners[0, 1], corners[1, 1]))
    inner_bottom = float(max(corners[2, 1], corners[3, 1]))
    opening_h = max(1.0, inner_bottom - inner_top)
    cut_top, cut_bottom = slice_lines(corners)
    w, h = mockup.size
    cut_top = min(max(1, cut_top), h - 3)
    cut_bottom = min(max(cut_top + 1, cut_bottom), h - 1)
    wall_end = min(max(8, int(inner_top) - 50), cut_top - 1)
    sliver = (cut_top - inner_top) + (inner_bottom - cut_bottom)
    new_mid_h = max(1, int(round(opening_h * height_scale - sliver)))
    actual_scale = new_mid_h / (cut_bottom - cut_top)

    wall = mockup.crop((0, 0, w, wall_end))
    top = mockup.crop((0, wall_end, w, cut_top))
    mid = mockup.crop((0, cut_top, w, cut_bottom)).resize(
        (w, new_mid_h), Image.Resampling.LANCZOS
    )
    bot = mockup.crop((0, cut_bottom, w, h))
    body_h = top.height + mid.height + bot.height
    if body_h >= h - 8:
        new_wall_h = wall.height
        canvas_h = wall.height + body_h
    else:
        new_wall_h = h - body_h
        canvas_h = h
    wall = wall.resize((w, new_wall_h), Image.Resampling.LANCZOS)

    sliced = Image.new("RGB", (w, canvas_h))
    sliced.paste(wall, (0, 0))
    sliced.paste(top, (0, wall.height))
    sliced.paste(mid, (0, wall.height + top.height))
    sliced.paste(bot, (0, wall.height + top.height + mid.height))

    mapped = (
        seed[0],
        int(round(map_y(seed[1], wall_end, cut_top, cut_bottom, actual_scale, new_wall_h))),
    )
    return sliced, mapped


def contain_resize(im: Image.Image, width: int, height: int) -> Image.Image:
    rgb = as_rgb(im)
    scale = min(width / rgb.width, height / rgb.height)
    nw = max(1, int(round(rgb.width * scale)))
    nh = max(1, int(round(rgb.height * scale)))
    resized = rgb.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), PAPER)
    canvas.paste(resized, ((width - nw) // 2, (height - nh) // 2))
    return canvas


def composite(
    poster: Image.Image, mockup: Image.Image, mask: Image.Image, corners: np.ndarray
) -> Image.Image:
    minx, miny = corners.min(axis=0)
    maxx, maxy = corners.max(axis=0)
    tw = max(64, int(round(maxx - minx)))
    th = max(64, int(round(maxy - miny)))
    art = contain_resize(poster, tw, th)
    src = [(0, 0), (tw - 1, 0), (tw - 1, th - 1), (0, th - 1)]
    coeffs = find_coeffs(src, corners)
    warped = art.transform(
        mockup.size,
        Image.Transform.PERSPECTIVE,
        coeffs,
        Image.Resampling.BICUBIC,
        fillcolor=PAPER,
    )
    return Image.composite(warped, mockup.convert("RGB"), mask)


def crop_to_ratio(im: Image.Image, ratio: float = 3 / 4) -> Image.Image:
    w, h = im.size
    if w / h > ratio:
        nw = max(1, int(round(h * ratio)))
        left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    nh = max(1, int(round(w / ratio)))
    top = (h - nh) // 2
    return im.crop((0, top, w, top + nh))


def save_jpeg(im: Image.Image, path: Path, max_side: int = 1800):
    path.parent.mkdir(parents=True, exist_ok=True)
    out = crop_to_ratio(as_rgb(im))
    scale = min(1.0, max_side / max(out.size))
    if scale < 1:
        out = out.resize(
            (int(out.width * scale), int(out.height * scale)),
            Image.Resampling.LANCZOS,
        )
    out.save(path, "JPEG", quality=92, optimize=True)


def lean_path(poster_id: str) -> str:
    return f"images/framed/{poster_id}-lean.jpg"


def with_lean_gallery(poster: dict) -> dict:
    path = lean_path(poster["id"])
    extras = [item for item in poster.get("gallery", []) if item and item != path]
    return {**poster, "gallery": [path, *extras]}


def main():
    mockup = Image.open(MOCKUP_PATH).convert("RGB")
    base_mask = paper_mask(mockup)
    base_corners = paper_corners(base_mask)
    avg_w, avg_h = opening_size(base_corners)
    print(MOCKUP_PATH.name, mockup.size, "opening", round(avg_w / avg_h, 3), base_corners.tolist())

    posters = json.loads(CATALOG_PATH.read_text())
    cache: dict[float, tuple[Image.Image, Image.Image, np.ndarray]] = {}
    updated = []
    for poster in posters:
        art = Image.open(ROOT / poster["image"])
        art_ratio = art.width / max(art.height, 1)
        target_h = avg_w / max(art_ratio, 0.05)
        height_scale = float(np.clip(target_h / avg_h, HEIGHT_SCALE_MIN, HEIGHT_SCALE_MAX))
        key = round(height_scale, 3)
        if key not in cache:
            sized, seed = scale_frame_height(mockup, base_corners, art_ratio)
            mask = paper_mask(sized, seed)
            corners = paper_corners(mask)
            cache[key] = (sized, mask, corners)
            ow, oh = opening_size(corners)
            print(f"  frame scale {key:.3f} opening {ow / oh:.3f} size {sized.size}")
        sized, mask, corners = cache[key]
        framed = composite(art, sized, mask, corners)
        dest = ROOT / lean_path(poster["id"])
        save_jpeg(framed, dest)
        updated.append(with_lean_gallery(poster))
        print("wrote", dest.relative_to(ROOT), "art", round(art_ratio, 3))

    CATALOG_PATH.write_text(json.dumps(updated, indent=2) + "\n")
    print("updated posters.json")


if __name__ == "__main__":
    main()
