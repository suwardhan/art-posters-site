(function () {
  const stored = localStorage.getItem("theme");
  document.documentElement.setAttribute("data-theme", stored || "light");
})();

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const posterList = document.getElementById("posterList");
const errorEl = document.getElementById("error");
const statusEl = document.getElementById("status");
const addForm = document.getElementById("addForm");
const addBtn = document.getElementById("addBtn");
const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");
const loginHint = document.getElementById("loginHint");

let posters = [];
let sha = "";
let repo = { owner: "suwardhan", repo: "art-posters-site", branch: "main" };

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST" });
  window.location.reload();
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(addForm);
  const title = String(data.get("title") || "").trim();
  const file = data.get("file");
  const url = String(data.get("url") || "").trim();
  if (!title) return;
  if (!(file && file.size) && !url) {
    showError("Upload a file or paste an image URL.");
    return;
  }

  addBtn.disabled = true;
  addBtn.textContent = "Adding…";
  showError("");

  try {
    const body = new FormData();
    body.set("title", title);
    if (file && file.size) body.set("file", file);
    if (url) body.set("url", url);
    const res = await api("/api/posters", { method: "POST", body });
    posters = res.posters;
    sha = res.sha;
    addForm.reset();
    render();
    flash("Added. The shop updates in about a minute.");
  } catch (err) {
    showError(err.message);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = "Add poster";
  }
});

async function boot() {
  try {
    const me = await api("/api/me");
    userLabel.hidden = false;
    userLabel.textContent = me.login;
    logoutBtn.hidden = false;
    loginView.hidden = true;
    appView.hidden = false;
    await loadPosters();
  } catch (err) {
    loginView.hidden = false;
    appView.hidden = true;
    if (err.status && err.status !== 401) {
      loginHint.textContent = err.message;
    }
  }
}

async function loadPosters() {
  const res = await api("/api/posters");
  posters = res.posters;
  sha = res.sha;
  render();
}

function render() {
  posterList.innerHTML = "";
  posters.forEach((poster, index) => {
    const li = document.createElement("li");
    li.className = "poster-row" + (poster.hidden ? " is-hidden" : "");
    li.draggable = true;
    li.dataset.id = poster.id;

    const imgSrc = rawImageUrl(poster.image);
    li.innerHTML = `
      <button type="button" class="drag-handle" aria-label="Drag to reorder">::</button>
      <img src="${escapeAttr(imgSrc)}" alt="" />
      <div class="poster-fields">
        <label>
          Name
          <input type="text" class="title-input" value="${escapeAttr(poster.title)}" maxlength="120" />
        </label>
      </div>
      <div class="row-actions">
        <button type="button" class="hide-btn">${poster.hidden ? "Show" : "Hide"}</button>
        <button type="button" class="up-btn" ${index === 0 ? "disabled" : ""}>Up</button>
        <button type="button" class="down-btn" ${index === posters.length - 1 ? "disabled" : ""}>Down</button>
      </div>
    `;

    const titleInput = li.querySelector(".title-input");
    titleInput.addEventListener("mousedown", (ev) => ev.stopPropagation());
    titleInput.addEventListener("change", () => {
      poster.title = titleInput.value.trim() || poster.title;
      titleInput.value = poster.title;
      saveCatalog();
    });

    li.querySelector(".hide-btn").addEventListener("click", () => {
      poster.hidden = !poster.hidden;
      saveCatalog();
    });
    li.querySelector(".up-btn").addEventListener("click", () => move(index, index - 1));
    li.querySelector(".down-btn").addEventListener("click", () => move(index, index + 1));

    li.addEventListener("dragstart", (ev) => {
      li.classList.add("is-dragging");
      ev.dataTransfer.setData("text/plain", poster.id);
      ev.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragend", () => li.classList.remove("is-dragging"));
    li.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
    });
    li.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const fromId = ev.dataTransfer.getData("text/plain");
      const from = posters.findIndex((p) => p.id === fromId);
      const to = posters.findIndex((p) => p.id === poster.id);
      if (from >= 0 && to >= 0 && from !== to) move(from, to);
    });

    posterList.appendChild(li);
  });
}

function move(from, to) {
  if (to < 0 || to >= posters.length) return;
  const [item] = posters.splice(from, 1);
  posters.splice(to, 0, item);
  saveCatalog();
}

async function saveCatalog() {
  showError("");
  render();
  try {
    const res = await api("/api/posters", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posters, sha }),
    });
    posters = res.posters;
    sha = res.sha;
    render();
    flash("Saved. The shop updates in about a minute.");
  } catch (err) {
    showError(err.message);
    try {
      await loadPosters();
    } catch (_) {}
  }
}

function rawImageUrl(image) {
  if (!image) return "";
  if (/^https?:/i.test(image)) return image;
  return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/${image}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

function flash(message) {
  statusEl.hidden = false;
  statusEl.textContent = message;
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

boot();
