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
const openAddBtn = document.getElementById("openAddBtn");
const addDialog = document.getElementById("addDialog");
const addDialogClose = document.getElementById("addDialogClose");
const addErrorEl = document.getElementById("addError");
const saveBtn = document.getElementById("saveBtn");
const userLabel = document.getElementById("userLabel");
const logoutBtn = document.getElementById("logoutBtn");
const loginHint = document.getElementById("loginHint");
const unsavedToast = document.getElementById("unsavedToast");
const toastSave = document.getElementById("toastSave");
const toastDiscard = document.getElementById("toastDiscard");

let posters = [];
let savedPosters = [];
let collections = [
  { id: "bollywood", title: "Bollywood movies" },
  { id: "furniture", title: "Furniture" },
  { id: "bathroom", title: "Bathroom" },
  { id: "abstract", title: "Abstract" },
  { id: "portraits", title: "Portraits" },
];
let sha = "";
let dirty = false;
let saving = false;
let repo = { owner: "suwardhan", repo: "art-posters-site", branch: "main" };

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

logoutBtn.addEventListener("click", async () => {
  if (dirty && !window.confirm("You have unsaved changes. Log out anyway?")) {
    return;
  }
  dirty = false;
  await fetch("/auth/logout", { method: "POST" });
  window.location.reload();
});

window.addEventListener("beforeunload", (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = "";
});

saveBtn.addEventListener("click", () => saveCatalog());
toastSave.addEventListener("click", () => saveCatalog());
toastDiscard.addEventListener("click", () => discardChanges());

openAddBtn.addEventListener("click", () => {
  if (dirty) {
    showError("Save or discard your changes before adding a poster.");
    return;
  }
  showAddError("");
  addForm.reset();
  fillCollectionSelect(document.getElementById("addCollection"), "bollywood");
  addDialog.showModal();
});

addDialogClose.addEventListener("click", () => addDialog.close());
addDialog.addEventListener("click", (e) => {
  if (e.target === addDialog) addDialog.close();
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (dirty) {
    showAddError("Save or discard your changes before adding a poster.");
    return;
  }

  const data = new FormData(addForm);
  const title = String(data.get("title") || "").trim();
  const file = data.get("file");
  const url = String(data.get("url") || "").trim();
  if (!title) return;
  if (!(file && file.size) && !url) {
    showAddError("Upload a file or paste an image URL.");
    return;
  }

  addBtn.disabled = true;
  addBtn.textContent = "Adding…";
  showAddError("");

  try {
    const body = new FormData();
    body.set("title", title);
    body.set("collection", String(data.get("collection") || "bollywood"));
    if (file && file.size) body.set("file", file);
    if (url) body.set("url", url);
    const res = await api("/api/posters", { method: "POST", body });
    addForm.reset();
    addDialog.close();
    setClean(res.posters, res.sha, res.collections);
    flash("Added. The shop updates in about a minute.");
  } catch (err) {
    showAddError(err.message);
  } finally {
    addBtn.textContent = "Add poster";
    updateDirtyUI();
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
  setClean(res.posters, res.sha, res.collections);
}

function setClean(nextPosters, nextSha, nextCollections) {
  posters = nextPosters;
  savedPosters = clone(nextPosters);
  if (Array.isArray(nextCollections) && nextCollections.length) {
    collections = nextCollections;
  }
  sha = nextSha;
  dirty = false;
  render();
  updateDirtyUI();
}

function fillCollectionSelect(select, selectedId) {
  if (!select) return;
  select.innerHTML = collections
    .map(
      (c) =>
        `<option value="${escapeAttr(c.id)}"${c.id === selectedId ? " selected" : ""}>${escapeAttr(c.title)}</option>`
    )
    .join("");
}

function markDirty() {
  dirty = true;
  updateDirtyUI();
}

function discardChanges() {
  posters = clone(savedPosters);
  dirty = false;
  showError("");
  render();
  updateDirtyUI();
  flash("Changes discarded.");
}

function updateDirtyUI() {
  unsavedToast.hidden = !dirty;
  saveBtn.disabled = !dirty || saving;
  saveBtn.classList.toggle("is-saving", saving);
  saveBtn.textContent = saving ? "Saving…" : "Save";
  toastSave.disabled = saving;
  toastDiscard.disabled = saving;
  addBtn.disabled = dirty || saving;
  openAddBtn.disabled = dirty || saving;
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
      <div class="card-meta">
        <button type="button" class="drag-handle" aria-label="Drag to reorder">::</button>
        <span class="poster-number">${index + 1}</span>
      </div>
      <img src="${escapeAttr(imgSrc)}" alt="${escapeAttr(poster.title)}" />
      <div class="card-overlay">
        <div class="card-info">
          <div class="card-fields">
            <input type="text" class="title-input" value="${escapeAttr(poster.title)}" maxlength="120" aria-label="Poster name" />
            <label class="collection-label">
              <span class="visually-hidden">Collection</span>
              <select class="collection-select" aria-label="Collection"></select>
            </label>
          </div>
          <div class="row-actions">
            <button type="button" class="hide-btn">${poster.hidden ? "Show" : "Hide"}</button>
            <button type="button" class="up-btn" ${index === 0 ? "disabled" : ""}>Up</button>
            <button type="button" class="down-btn" ${index === posters.length - 1 ? "disabled" : ""}>Down</button>
          </div>
        </div>
      </div>
    `;

    const titleInput = li.querySelector(".title-input");
    const collectionSelect = li.querySelector(".collection-select");
    fillCollectionSelect(collectionSelect, poster.collection || "bollywood");
    titleInput.addEventListener("mousedown", (ev) => ev.stopPropagation());
    collectionSelect.addEventListener("mousedown", (ev) => ev.stopPropagation());
    li.querySelector(".hide-btn").addEventListener("mousedown", (ev) => ev.stopPropagation());
    li.querySelector(".up-btn").addEventListener("mousedown", (ev) => ev.stopPropagation());
    li.querySelector(".down-btn").addEventListener("mousedown", (ev) => ev.stopPropagation());
    titleInput.addEventListener("change", () => {
      poster.title = titleInput.value.trim() || poster.title;
      titleInput.value = poster.title;
      markDirty();
    });
    collectionSelect.addEventListener("change", () => {
      poster.collection = collectionSelect.value;
      markDirty();
    });

    li.querySelector(".hide-btn").addEventListener("click", () => {
      poster.hidden = !poster.hidden;
      markDirty();
      render();
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
  markDirty();
  render();
}

async function saveCatalog() {
  if (!dirty || saving) return;
  saving = true;
  updateDirtyUI();
  showError("");

  try {
    const res = await api("/api/posters", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posters, sha }),
    });
    setClean(res.posters, res.sha, res.collections);
    flash("Saved. The shop updates in about a minute.");
  } catch (err) {
    showError(err.message);
  } finally {
    saving = false;
    updateDirtyUI();
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

function showAddError(message) {
  addErrorEl.hidden = !message;
  addErrorEl.textContent = message || "";
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
