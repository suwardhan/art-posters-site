#!/usr/bin/env python3
"""Place each catalog print inside the leaning-frame mockup."""

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


def paper_mask(mockup: Image.Image) -> Image.Image:
    arr = np.array(mockup.convert("RGB"))
    h, w = arr.shape[:2]
    target = np.array(PAPER, dtype=np.int16)
    ok = np.abs(arr.astype(np.int16) - target).max(axis=2) <= 6
    ring = np.zeros((h, w), dtype=bool)
    q = deque([MAT_SEED])
    ring[MAT_SEED[1], MAT_SEED[0]] = True
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


def cover_resize(im: Image.Image, width: int, height: int) -> Image.Image:
    rgb = as_rgb(im)
    scale = max(width / rgb.width, height / rgb.height)
    nw = max(1, int(round(rgb.width * scale)))
    nh = max(1, int(round(rgb.height * scale)))
    resized = rgb.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - width) // 2)
    top = max(0, (nh - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def contain_resize(im: Image.Image, width: int, height: int) -> Image.Image:
    rgb = as_rgb(im)
    scale = min(width / rgb.width, height / rgb.height)
    nw = max(1, int(round(rgb.width * scale)))
    nh = max(1, int(round(rgb.height * scale)))
    resized = rgb.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), PAPER)
    canvas.paste(resized, ((width - nw) // 2, (height - nh) // 2))
    return canvas


def fit_print(im: Image.Image, width: int, height: int) -> Image.Image:
    if im.width / im.height >= 0.9:
        return contain_resize(im, width, height)
    return cover_resize(im, width, height)


def composite(poster: Image.Image, mockup: Image.Image, mask: Image.Image, corners: np.ndarray) -> Image.Image:
    minx, miny = corners.min(axis=0)
    maxx, maxy = corners.max(axis=0)
    tw = max(64, int(round(maxx - minx)))
    th = max(64, int(round(maxy - miny)))
    art = fit_print(poster, tw, th)
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
    mask = paper_mask(mockup)
    corners = paper_corners(mask)
    print(MOCKUP_PATH.name, mockup.size, corners.tolist())

    posters = json.loads(CATALOG_PATH.read_text())
    updated = []
    for poster in posters:
        art = Image.open(ROOT / poster["image"])
        framed = composite(art, mockup, mask, corners)
        dest = ROOT / lean_path(poster["id"])
        save_jpeg(framed, dest)
        updated.append(with_lean_gallery(poster))
        print("wrote", dest.relative_to(ROOT))

    CATALOG_PATH.write_text(json.dumps(updated, indent=2) + "\n")
    print("updated posters.json")


if __name__ == "__main__":
    main()
