import { COLLECTIONS, seoFilesFromCatalog } from "../lib/seo-pages.mjs";

const DEFAULT_COLLECTION = "bollywood";
const SESSION_COOKIE = "ckd_session";
const STATE_COOKIE = "ckd_oauth_state";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const GH_API = "https://api.github.com";
const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "ChaudharykiDiary-Admin",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) {
        return await handleApp(request, env, url);
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return json({ error: err.message || "Server error" }, 500);
    }
  },
};

async function handleApp(request, env, url) {
  if (url.pathname === "/auth/login" && request.method === "GET") {
    return startLogin(url, env);
  }
  if (url.pathname === "/auth/callback" && request.method === "GET") {
    return finishLogin(request, url, env);
  }
  if (url.pathname === "/auth/logout" && request.method === "POST") {
    return logout(url);
  }

  const session = await readSession(request, env);

  if (url.pathname === "/api/me" && request.method === "GET") {
    if (!session) return json({ error: "Unauthorized" }, 401);
    return json({ login: session.login });
  }

  if (!session) return json({ error: "Unauthorized" }, 401);

  if (url.pathname === "/api/posters" && request.method === "GET") {
    const file = await getRepoFile(env, "posters.json");
    return json({ posters: normalizeCatalog(file.text), collections: COLLECTIONS, sha: file.sha });
  }

  if (url.pathname === "/api/posters" && request.method === "PUT") {
    const body = await request.json();
    const current = await getRepoFile(env, "posters.json");
    if (body.sha && body.sha !== current.sha) {
      return json({ error: "Catalog changed. Refresh and try again." }, 409);
    }
    const posters = sanitizeCatalog(body.posters, normalizeCatalog(current.text));
    const catalogText = JSON.stringify(posters, null, 2) + "\n";
    await commitCatalogAndSeo(
      env,
      posters,
      catalogText,
      `admin: update posters (${session.login})`
    );
    const saved = await getRepoFile(env, "posters.json");
    return json({ posters, collections: COLLECTIONS, sha: saved.sha });
  }

  if (url.pathname === "/api/posters" && request.method === "POST") {
    return addPoster(request, env, session);
  }

  return json({ error: "Not found" }, 404);
}

async function addPoster(request, env, session) {
  const contentType = request.headers.get("content-type") || "";
  let title = "";
  let collection = DEFAULT_COLLECTION;
  let imageBytes = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    title = String(form.get("title") || "").trim();
    collection = collectionId(form.get("collection"));
    const file = form.get("file");
    const imageUrl = String(form.get("url") || "").trim();

    if (file && typeof file === "object" && file.size) {
      if (file.size > MAX_IMAGE_BYTES) {
        return json({ error: "Image must be 8MB or smaller." }, 400);
      }
      imageBytes = new Uint8Array(await file.arrayBuffer());
    } else if (imageUrl) {
      imageBytes = await fetchImageBytes(imageUrl);
    }
  } else {
    const body = await request.json();
    title = String(body.title || "").trim();
    collection = collectionId(body.collection);
    if (body.url) imageBytes = await fetchImageBytes(String(body.url));
  }

  if (!title) return json({ error: "Title is required." }, 400);
  if (!imageBytes) return json({ error: "Upload a file or paste an image URL." }, 400);

  const ext = extensionForImage(imageBytes);
  if (!ext) return json({ error: "Use a JPEG, PNG, WebP, or GIF image." }, 400);

  const catalogFile = await getRepoFile(env, "posters.json");
  const posters = normalizeCatalog(catalogFile.text);
  const id = uniqueId(slugify(title), posters);
  const imagePath = `images/${id}.${ext}`;
  const next = posters.concat([{ id, title, image: imagePath, hidden: false, collection }]);
  const catalogText = JSON.stringify(next, null, 2) + "\n";

  await commitCatalogAndSeo(
    env,
    next,
    catalogText,
    `admin: add poster ${title} (${session.login})`,
    [{ path: imagePath, content: imageBytes }]
  );

  const saved = await getRepoFile(env, "posters.json");
  return json({ posters: next, collections: COLLECTIONS, sha: saved.sha });
}

async function startLogin(url, env) {
  if (!env.GITHUB_CLIENT_ID || !env.SESSION_SECRET) {
    return json(
      { error: "GitHub OAuth is not configured yet. Set GITHUB_CLIENT_ID and SESSION_SECRET." },
      500
    );
  }

  const state = randomToken();
  const redirectUri = `${url.origin}/auth/callback`;
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  gh.searchParams.set("redirect_uri", redirectUri);
  gh.searchParams.set("scope", "read:user");
  gh.searchParams.set("state", state);

  const res = new Response(null, {
    status: 302,
    headers: { Location: gh.toString() },
  });
  res.headers.append(
    "Set-Cookie",
    cookie(STATE_COOKIE, state, { maxAge: 600, httpOnly: true, secure: isHttps(url) })
  );
  return res;
}

async function finishLogin(request, url, env) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = cookieValue(request, STATE_COOKIE);

  if (!code || !state || !expected || state !== expected) {
    return json({ error: "Invalid login state. Try again." }, 400);
  }

  const redirectUri = `${url.origin}/auth/callback`;
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": GH_HEADERS["User-Agent"],
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return json({ error: "GitHub login failed." }, 401);
  }

  const userRes = await fetch(`${GH_API}/user`, {
    headers: {
      ...GH_HEADERS,
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const user = await userRes.json();
  const login = String(user.login || "").toLowerCase();
  const allowed = allowedUsers(env);

  const clearState = cookie(STATE_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure: isHttps(url),
  });

  if (!allowed.includes(login)) {
    const res = new Response("This GitHub account is not allowed to use admin.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    res.headers.append("Set-Cookie", clearState);
    return res;
  }

  const session = await signSession({ login, exp: nowSec() + SESSION_TTL_SEC }, env.SESSION_SECRET);
  const res = new Response(null, {
    status: 302,
    headers: { Location: "/" },
  });
  res.headers.append("Set-Cookie", clearState);
  res.headers.append(
    "Set-Cookie",
    cookie(SESSION_COOKIE, session, {
      maxAge: SESSION_TTL_SEC,
      httpOnly: true,
      secure: isHttps(url),
    })
  );
  return res;
}

function logout(url) {
  const res = json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    cookie(SESSION_COOKIE, "", { maxAge: 0, httpOnly: true, secure: isHttps(url) })
  );
  return res;
}

function allowedUsers(env) {
  return String(env.ALLOWED_GITHUB_USERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function readSession(request, env) {
  if (!env.SESSION_SECRET) return null;
  const raw = cookieValue(request, SESSION_COOKIE);
  if (!raw) return null;
  const payload = await verifySession(raw, env.SESSION_SECRET);
  if (!payload || payload.exp < nowSec()) return null;
  if (!allowedUsers(env).includes(String(payload.login || "").toLowerCase())) {
    return null;
  }
  return payload;
}

async function getRepoFile(env, path) {
  const { owner, repo } = repoParts(env);
  const res = await gh(env, `/repos/${owner}/${repo}/contents/${path}?ref=${env.GITHUB_BRANCH}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Could not read ${path}: ${res.status} ${detail}`);
  }
  const data = await res.json();
  const bytes = base64ToBytes(data.content);
  return {
    sha: data.sha,
    bytes,
    text: new TextDecoder().decode(bytes),
  };
}

async function putRepoFile(env, path, body, sha, message) {
  const { owner, repo } = repoParts(env);
  const content = typeof body === "string" ? utf8ToBase64(body) : bytesToBase64(body);
  const payload = {
    message,
    content,
    branch: env.GITHUB_BRANCH,
  };
  if (sha) payload.sha = sha;

  const res = await gh(env, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Could not save ${path}: ${res.status} ${detail}`);
  }
  const data = await res.json();
  return { sha: data.content.sha };
}

async function deleteRepoFile(env, path, sha, message) {
  const { owner, repo } = repoParts(env);
  const res = await gh(env, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "DELETE",
    body: JSON.stringify({
      message,
      sha,
      branch: env.GITHUB_BRANCH,
    }),
  });
  if (!res.ok && res.status !== 404) {
    const detail = await res.text();
    throw new Error(`Could not delete ${path}: ${res.status} ${detail}`);
  }
}

async function listPrintIds(env) {
  const { owner, repo } = repoParts(env);
  const res = await gh(env, `/repos/${owner}/${repo}/contents/prints?ref=${env.GITHUB_BRANCH}`);
  if (res.status === 404) return [];
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Could not list prints: ${res.status} ${detail}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter((item) => item.type === "dir").map((item) => item.name);
}

async function commitCatalogAndSeo(env, posters, catalogText, message, extraFiles = []) {
  const existingPrintIds = await listPrintIds(env);
  const { upserts, deletions } = seoFilesFromCatalog(posters, { existingPrintIds });
  const files = [
    { path: "posters.json", content: catalogText },
    ...extraFiles,
    ...upserts,
    ...deletions.map((path) => ({ path, deleted: true })),
  ];
  try {
    await commitFiles(env, files, message);
  } catch (err) {
    console.error("Git tree commit failed, falling back to contents API:", err);
    await commitFilesViaContents(env, files, message);
  }
}

async function commitFiles(env, files, message) {
  const { owner, repo } = repoParts(env);
  const branch = env.GITHUB_BRANCH;
  const refRes = await gh(env, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  if (!refRes.ok) {
    throw new Error(`Could not read git ref: ${refRes.status} ${await refRes.text()}`);
  }
  const ref = await refRes.json();
  const commitSha = ref.object.sha;
  const commitRes = await gh(env, `/repos/${owner}/${repo}/git/commits/${commitSha}`);
  if (!commitRes.ok) {
    throw new Error(`Could not read git commit: ${commitRes.status} ${await commitRes.text()}`);
  }
  const commit = await commitRes.json();

  const treeItems = [];
  for (const file of files) {
    if (file.deleted) {
      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const isString = typeof file.content === "string";
    const blobRes = await gh(env, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify(
        isString
          ? { content: file.content, encoding: "utf-8" }
          : { content: bytesToBase64(file.content), encoding: "base64" }
      ),
    });
    if (!blobRes.ok) {
      throw new Error(`Could not create blob for ${file.path}: ${blobRes.status} ${await blobRes.text()}`);
    }
    const blob = await blobRes.json();
    treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const treeRes = await gh(env, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: commit.tree.sha, tree: treeItems }),
  });
  if (!treeRes.ok) {
    throw new Error(`Could not create git tree: ${treeRes.status} ${await treeRes.text()}`);
  }
  const tree = await treeRes.json();

  const newCommitRes = await gh(env, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [commitSha],
    }),
  });
  if (!newCommitRes.ok) {
    throw new Error(`Could not create git commit: ${newCommitRes.status} ${await newCommitRes.text()}`);
  }
  const newCommit = await newCommitRes.json();

  const updateRes = await gh(env, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha }),
  });
  if (!updateRes.ok) {
    throw new Error(`Could not update git ref: ${updateRes.status} ${await updateRes.text()}`);
  }
}

async function commitFilesViaContents(env, files, message) {
  for (const file of files) {
    if (file.deleted) {
      try {
        const current = await getRepoFile(env, file.path);
        await deleteRepoFile(env, file.path, current.sha, message);
      } catch {
        /* already absent */
      }
      continue;
    }
    let sha = null;
    try {
      const current = await getRepoFile(env, file.path);
      sha = current.sha;
    } catch {
      sha = null;
    }
    await putRepoFile(env, file.path, file.content, sha, message);
  }
}

async function gh(env, path, init = {}) {
  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not set on the Worker.");
  }
  return fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      ...GH_HEADERS,
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      ...(init.headers || {}),
    },
  });
}

function repoParts(env) {
  const [owner, repo] = String(env.GITHUB_REPO || "").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPO must be owner/name.");
  return { owner, repo };
}

function collectionId(value) {
  const id = String(value || "").trim();
  return COLLECTIONS.some((c) => c.id === id) ? id : DEFAULT_COLLECTION;
}

function normalizeCatalog(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) parsed = Array.isArray(parsed?.posters) ? parsed.posters : [];
  const used = new Set();
  return parsed.map((p, i) => {
    const title = String(p.title || "Untitled").trim() || "Untitled";
    const image = String(p.image || "").trim();
    let id = slugify(p.id || image.replace(/^.*\//, "").replace(/\.[^.]+$/, "") || title);
    if (!id) id = `poster-${i + 1}`;
    while (used.has(id)) id = `${id}-2`;
    used.add(id);
    return {
      id,
      title,
      image,
      hidden: Boolean(p.hidden),
      collection: collectionId(p.collection),
    };
  });
}

function sanitizeCatalog(incoming, current) {
  if (!Array.isArray(incoming)) throw new Error("Invalid catalog.");
  const byId = new Map(current.map((p) => [p.id, p]));
  const used = new Set();
  const next = [];

  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (!existing) continue;
    if (used.has(existing.id)) continue;
    used.add(existing.id);
    const title = String(item.title || existing.title).trim() || existing.title;
    next.push({
      id: existing.id,
      title,
      image: existing.image,
      hidden: Boolean(item.hidden),
      collection: collectionId(item.collection || existing.collection),
    });
  }

  for (const item of current) {
    if (!used.has(item.id)) next.push(item);
  }
  return next;
}

function uniqueId(base, posters) {
  let id = base || "poster";
  const used = new Set(posters.map((p) => p.id));
  if (!used.has(id)) return id;
  let n = 2;
  while (used.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function fetchImageBytes(rawUrl) {
  const url = driveDownloadUrl(rawUrl) || rawUrl;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That URL is not valid.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("That URL is not valid.");
  }

  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": GH_HEADERS["User-Agent"] },
    redirect: "follow",
  });
  if (!res.ok) throw new Error("Could not download that image URL.");

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 8MB or smaller.");
  }
  return new Uint8Array(buffer);
}

function driveDownloadUrl(url) {
  const idMatch =
    url.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!url.includes("drive.google.com") || !idMatch) return null;
  return `https://drive.google.com/uc?export=download&id=${idMatch[1]}&confirm=t`;
}

function extensionForImage(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "gif";
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

async function signSession(payload, secret) {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

async function verifySession(token, secret) {
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await hmac(secret, body);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return b64url(new Uint8Array(bytes));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function isHttps(url) {
  return url.protocol === "https:";
}

function cookie(name, value, { maxAge, httpOnly, secure }) {
  const parts = [`${name}=${value}`, "Path=/", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (httpOnly) parts.push("HttpOnly");
  parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

function cookieValue(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return base64ToBytes(b64);
}
