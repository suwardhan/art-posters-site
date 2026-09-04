// Paste your Google Apps Script web app URL after deploying (see apps-script/Code.gs).
const ORDER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzzRpEg24-bgleWh7k97SSnkgtiMmIOZrEd5cOA88Xv3v11oHH3QWhi_USdD6LQ8dE-0Q/exec";

// Keep in sync with apps-script/Code.gs PRICE_BY_SIZE.
// Tiers: €25 small · €40 medium · €55 large · €75 extra large
const DEFAULT_SIZE = "11.69″×16.54″";
const POSTER_SIZES = [
  { id: "5″×7″", label: "5″×7″", price: 25 },
  { id: "6″×8″", label: "6″×8″", price: 25 },
  { id: "8″×10″", label: "8″×10″", price: 25 },
  { id: "8″×12″", label: "8″×12″", price: 25 },
  { id: "8.27″×11.69″", label: "8.27″×11.69″ (A4)", price: 25 },
  { id: "9″×11″", label: "9″×11″", price: 25 },
  { id: "10″×10″", label: "10″×10″", price: 25 },
  { id: "8″×20″", label: "8″×20″", price: 40 },
  { id: "10″×24″", label: "10″×24″", price: 40 },
  { id: "11″×14″", label: "11″×14″", price: 40 },
  { id: "11″×17″", label: "11″×17″", price: 40 },
  { id: "11.69″×16.54″", label: "11.69″×16.54″ (A3)", price: 40 },
  { id: "12″×12″", label: "12″×12″", price: 40 },
  { id: "12″×16″", label: "12″×16″", price: 40 },
  { id: "12″×18″", label: "12″×18″", price: 40 },
  { id: "14″×14″", label: "14″×14″", price: 40 },
  { id: "16″×16″", label: "16″×16″", price: 55 },
  { id: "16″×20″", label: "16″×20″", price: 55 },
  { id: "16″×24″", label: "16″×24″", price: 55 },
  { id: "18″×18″", label: "18″×18″", price: 55 },
  { id: "18″×24″", label: "18″×24″", price: 55 },
  { id: "A2 (16.5″×23.3″)", label: "A2 (16.5″×23.3″)", price: 55 },
  { id: "20″×20″", label: "20″×20″", price: 55 },
  { id: "20″×24″", label: "20″×24″", price: 55 },
  { id: "20″×28″", label: "20″×28″", price: 75 },
  { id: "20″×30″", label: "20″×30″", price: 75 },
  { id: "A1 (23.3″×33.1″)", label: "A1 (23.3″×33.1″)", price: 75 },
  { id: "24″×24″", label: "24″×24″", price: 75 },
  { id: "24″×32″", label: "24″×32″", price: 75 },
  { id: "24″×36″", label: "24″×36″", price: 75 },
  { id: "28″×28″", label: "28″×28″", price: 75 },
  { id: "28″×40″", label: "28″×40″", price: 75 },
  { id: "30″×40″", label: "30″×40″", price: 75 },
];

function priceForSize(sizeId) {
  const match = POSTER_SIZES.find((s) => s.id === sizeId);
  return match ? match.price : 0;
}

function publishedPosters(posters) {
  return (posters || []).filter((p) => p && p.hidden !== true);
}

function catalogPosters(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.posters) ? data.posters : [];
}

const COLLECTIONS = [
  { id: "bollywood", title: "Bollywood movies" },
  { id: "furniture", title: "Furniture" },
  { id: "bathroom", title: "Bathroom" },
  { id: "abstract", title: "Abstract" },
  { id: "portraits", title: "Portraits" },
];

function collectionById(id) {
  return COLLECTIONS.find((c) => c.id === id) || COLLECTIONS[0];
}

function collectionFromHash() {
  const id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  return COLLECTIONS.some((c) => c.id === id) ? id : "bollywood";
}

function mountCollectionTabs(activeId) {
  const tabsEl = document.getElementById("collectionTabs");
  if (!tabsEl) return;
  const onGallery = Boolean(document.getElementById("masonry"));
  const prefix = onGallery ? "#" : "posters/#";
  tabsEl.innerHTML = "";
  COLLECTIONS.forEach((collection) => {
    const tab = document.createElement("a");
    tab.className = "collection-tab" + (collection.id === activeId ? " is-active" : "");
    tab.href = prefix + collection.id;
    tab.textContent = collection.title;
    tab.dataset.collection = collection.id;
    if (onGallery) {
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", collection.id === activeId ? "true" : "false");
    }
    tabsEl.appendChild(tab);
  });
}

function syncCollectionTabs(activeId) {
  const tabsEl = document.getElementById("collectionTabs");
  if (!tabsEl) return;
  if (!tabsEl.children.length) {
    mountCollectionTabs(activeId);
    return;
  }
  tabsEl.querySelectorAll(".collection-tab").forEach((tab) => {
    const on = tab.dataset.collection === activeId;
    tab.classList.toggle("is-active", on);
    if (tab.hasAttribute("aria-selected")) {
      tab.setAttribute("aria-selected", on ? "true" : "false");
    }
  });
}

// ── Theme toggle ──
(function () {
  const stored = localStorage.getItem("theme");
  const theme = stored || "light";
  document.documentElement.setAttribute("data-theme", theme);
})();

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  initOrderDialog();
  initHomePosterSlideshow();
});

const POSTER_BLURB =
  "Limited edition art print. Colour, form, and silence - made to live with you, not just to be looked at.";

const masonry = document.getElementById("masonry");
if (masonry) {
  let expandedCard = null;
  let closing = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const zoom = document.createElement("div");
  zoom.className = "poster-zoom";
  zoom.hidden = true;
  zoom.setAttribute("role", "dialog");
  zoom.setAttribute("aria-modal", "true");
  zoom.setAttribute("aria-labelledby", "posterZoomTitle");
  zoom.innerHTML = `
    <button type="button" class="poster-zoom-backdrop" aria-label="Close poster"></button>
    <div class="poster-zoom-layout">
      <div class="poster-zoom-media">
        <img alt="" />
      </div>
      <div class="poster-zoom-copy">
        <h2 id="posterZoomTitle"></h2>
        <p></p>
        <button type="button" class="btn-buy">Buy Print</button>
      </div>
    </div>
  `;
  document.body.appendChild(zoom);

  const zoomLayout = zoom.querySelector(".poster-zoom-layout");
  const zoomMedia = zoom.querySelector(".poster-zoom-media");
  const zoomImg = zoom.querySelector("img");
  const zoomTitle = zoom.querySelector("h2");
  const zoomBlurb = zoom.querySelector("p");
  const zoomCopy = zoom.querySelector(".poster-zoom-copy");
  const zoomBuy = zoom.querySelector(".btn-buy");
  const zoomBackdrop = zoom.querySelector(".poster-zoom-backdrop");

  function detailsOnLeft(card) {
    const grid = masonry.getBoundingClientRect();
    if (grid.width < 540) return false;
    const box = card.getBoundingClientRect();
    const mid = box.left + box.width / 2;
    return mid - grid.left > grid.width * 0.55;
  }

  let expandToken = 0;

  function placeZoom(card) {
    const grid = masonry.getBoundingClientRect();
    const pad = 16;
    zoomLayout.style.width = "";
    const height = zoomLayout.offsetHeight;
    const width = zoomLayout.offsetWidth;
    const idealTop = card.getBoundingClientRect().top;
    const maxTop = Math.max(pad, window.innerHeight - height - pad);
    zoomLayout.style.top = `${Math.min(Math.max(pad, idealTop), maxTop)}px`;

    const maxLeft = Math.max(pad, window.innerWidth - width - pad);
    const idealLeft = zoomLayout.classList.contains("is-details-left")
      ? grid.right - width
      : grid.left;
    zoomLayout.style.left = `${Math.min(Math.max(pad, idealLeft), maxLeft)}px`;
  }

  function finishClose(card) {
    zoom.hidden = true;
    zoom.classList.remove("is-preparing");
    zoomImg.style.transition = "";
    zoomImg.style.transform = "";
    zoomCopy.style.transition = "";
    zoomCopy.style.opacity = "";
    zoomBackdrop.style.transition = "";
    zoomBackdrop.style.opacity = "";
    card.classList.remove("is-zoomed");
    card.setAttribute("aria-expanded", "false");
    expandedCard = null;
    closing = false;
    document.body.style.overflow = "";
  }

  function collapse() {
    expandToken += 1;
    if (!expandedCard || closing) return;
    const card = expandedCard;
    const preparing = zoom.classList.contains("is-preparing");

    if (reduceMotion || preparing) {
      finishClose(card);
      return;
    }

    closing = true;
    const first = zoomImg.getBoundingClientRect();
    const last = card.querySelector("img").getBoundingClientRect();
    zoomCopy.style.transition = "opacity 0.15s ease";
    zoomCopy.style.opacity = "0";
    zoomBackdrop.style.transition = "opacity 0.25s ease";
    zoomBackdrop.style.opacity = "0";

    const dx = last.left - first.left;
    const dy = last.top - first.top;
    const sx = last.width / Math.max(first.width, 1);
    const sy = last.height / Math.max(first.height, 1);
    zoomImg.style.transition = "transform 0.4s ease";
    zoomImg.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    window.setTimeout(() => finishClose(card), 420);
  }

  function playExpand(card, first) {
    placeZoom(card);

    if (reduceMotion) {
      zoom.classList.remove("is-preparing");
      card.classList.add("is-zoomed");
      zoomCopy.style.opacity = "1";
      zoomBackdrop.style.opacity = "1";
      return;
    }

    const last = zoomImg.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / Math.max(last.width, 1);
    const sy = first.height / Math.max(last.height, 1);
    zoomImg.style.transition = "none";
    zoomImg.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    void zoomImg.offsetWidth;
    zoom.classList.remove("is-preparing");
    card.classList.add("is-zoomed");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        zoomImg.style.transition = "transform 0.45s ease";
        zoomCopy.style.transition = "opacity 0.35s ease 0.12s";
        zoomBackdrop.style.transition = "opacity 0.35s ease";
        zoomImg.style.transform = "none";
        zoomCopy.style.opacity = "1";
        zoomBackdrop.style.opacity = "1";
      });
    });
  }

  function expand(card) {
    if (closing) return;
    if (expandedCard === card) {
      collapse();
      return;
    }
    if (expandedCard) {
      expandedCard.classList.remove("is-zoomed");
      expandedCard.setAttribute("aria-expanded", "false");
      expandedCard = null;
    }

    const token = (expandToken += 1);
    const thumb = card.querySelector("img");
    const first = thumb.getBoundingClientRect();
    const title = card.dataset.title;
    const image = card.dataset.image;

    zoomTitle.textContent = title;
    zoomBlurb.textContent = POSTER_BLURB;
    zoomImg.alt = title;
    zoomBuy.dataset.title = title;
    zoomBuy.dataset.image = image;
    zoomLayout.classList.toggle("is-details-left", detailsOnLeft(card));
    zoomCopy.style.opacity = "0";
    zoomBackdrop.style.opacity = "0";
    zoom.classList.add("is-preparing");
    zoom.hidden = false;
    document.body.style.overflow = "hidden";
    card.setAttribute("aria-expanded", "true");
    expandedCard = card;

    const start = async () => {
      if (token !== expandToken) return;
      try {
        if (typeof zoomImg.decode === "function") await zoomImg.decode();
      } catch (_) {
        /* decode can reject on broken images; layout still works after load */
      }
      if (token !== expandToken) return;
      playExpand(card, first);
    };

    if (zoomImg.getAttribute("src") === image && zoomImg.complete && zoomImg.naturalWidth) {
      start();
    } else {
      zoomImg.addEventListener("load", start, { once: true });
      zoomImg.addEventListener("error", start, { once: true });
      if (zoomImg.getAttribute("src") !== image) zoomImg.src = image;
    }
  }

  zoomBuy.addEventListener("click", (e) => {
    e.stopPropagation();
    openOrderDialog({
      title: zoomBuy.dataset.title,
      image: zoomBuy.dataset.image,
    });
  });
  zoomCopy.addEventListener("click", (e) => e.stopPropagation());
  zoomMedia.addEventListener("click", () => collapse());
  zoomBackdrop.addEventListener("click", () => collapse());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") collapse();
  });

  window.addEventListener("resize", () => {
    if (expandedCard) collapse();
  });

  const heroTitle = document.getElementById("collectionHeroTitle");
  const heroCopy = document.getElementById("collectionHeroCopy");
  const PLACEHOLDER_COUNT = 8;
  const PLACEHOLDER_RATIOS = ["3 / 4", "2 / 3", "4 / 5", "3 / 5", "5 / 7", "2 / 3", "3 / 4", "4 / 5"];
  let allPosters = [];
  let activeCollection = collectionFromHash();

  function setHero(collection) {
    if (!heroTitle || !heroCopy) return;
    if (collection.id === "bollywood") {
      heroTitle.textContent = "Bollywood, reimagined.";
      heroCopy.textContent = "Limited edition art prints of classic Indian cinema.";
    } else {
      heroTitle.textContent = `${collection.title}.`;
      heroCopy.textContent = "Limited edition art prints.";
    }
  }

  mountCollectionTabs(activeCollection);
  setHero(collectionById(activeCollection));

  function appendPlaceholder(index) {
    const card = document.createElement("div");
    card.className = "card is-placeholder";
    card.setAttribute("aria-hidden", "true");
    const block = document.createElement("div");
    block.className = "placeholder-block";
    block.style.aspectRatio = PLACEHOLDER_RATIOS[index % PLACEHOLDER_RATIOS.length];
    card.appendChild(block);
    masonry.appendChild(card);
  }

  function appendPoster(p) {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-expanded", "false");

    const imgSrc = p.image.startsWith("images/") ? `../${p.image}` : p.image;
    card.dataset.title = p.title;
    card.dataset.image = imgSrc;

    card.innerHTML = `
        <img src="${imgSrc}" alt="${escapeHtml(p.title)}" loading="lazy" />
        <div class="card-overlay">
          <div class="card-info">
            <span class="card-title">${escapeHtml(p.title)}</span>
            <button type="button" class="btn-buy" data-title="${escapeAttr(p.title)}" data-image="${escapeAttr(imgSrc)}">Buy Print</button>
          </div>
        </div>
      `;

    const buyBtn = card.querySelector(".btn-buy");
    buyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openOrderDialog({
        title: buyBtn.dataset.title,
        image: buyBtn.dataset.image,
      });
    });

    card.addEventListener("click", () => expand(card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        expand(card);
      }
    });

    masonry.appendChild(card);
  }

  function renderCollection() {
    collapse();
    const collection = collectionById(activeCollection);
    setHero(collection);
    syncCollectionTabs(activeCollection);
    masonry.innerHTML = "";
    const items = publishedPosters(allPosters).filter(
      (p) => (p.collection || "bollywood") === activeCollection
    );
    items.forEach(appendPoster);
    const placeholders = Math.max(0, PLACEHOLDER_COUNT - items.length);
    for (let i = 0; i < placeholders; i++) appendPlaceholder(i);
  }

  function selectCollection(id, updateHash) {
    const next = collectionById(id).id;
    if (next === activeCollection && masonry.children.length) {
      syncCollectionTabs(activeCollection);
      return;
    }
    activeCollection = next;
    if (updateHash) {
      history.replaceState(null, "", `#${activeCollection}`);
    }
    renderCollection();
  }

  fetch("../posters.json")
    .then((res) => res.json())
    .then((data) => {
      allPosters = catalogPosters(data);
      activeCollection = collectionFromHash();
      renderCollection();
    });

  window.addEventListener("hashchange", () => {
    selectCollection(collectionFromHash(), false);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

function initHomePosterSlideshow() {
  const slides = document.querySelectorAll(".home-tile-slide");
  if (slides.length < 2) return;

  fetch("posters.json")
    .then((res) => res.json())
    .then((data) => {
      const urls = publishedPosters(catalogPosters(data))
        .filter((p) => (p.collection || "bollywood") === "bollywood")
        .map((p) => (p.image.startsWith("images/") ? p.image : p.image));
      if (!urls.length) return;

      slides[0].src = urls[0];
      let index = 0;
      let showing = 0;

      const preload = (url) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = url;
        });

      const advance = async () => {
        index = (index + 1) % urls.length;
        const next = 1 - showing;
        await preload(urls[index]);
        slides[next].src = urls[index];
        slides[next].classList.add("is-active");
        slides[showing].classList.remove("is-active");
        showing = next;
      };

      setInterval(advance, 5000);
    })
    .catch(() => {});
}

function initOrderDialog() {
  const dialog = document.getElementById("orderDialog");
  if (!dialog) return;

  const form = document.getElementById("orderForm");
  const sizeInput = document.getElementById("orderSize");
  const chipsEl = document.getElementById("orderSizeChips");
  const qtyInput = document.getElementById("orderQty");
  const totalEl = document.getElementById("orderTotal");
  const unitPriceEl = document.getElementById("orderUnitPrice");
  const errorEl = document.getElementById("orderError");
  const submitBtn = document.getElementById("orderSubmit");
  const formView = document.getElementById("orderFormView");
  const confirmView = document.getElementById("orderConfirmView");
  const confirmCode = document.getElementById("orderConfirmCode");

  const updateTotal = () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const unit = priceForSize(sizeInput.value);
    unitPriceEl.textContent = `€${unit} per print`;
    totalEl.textContent = `€${qty * unit}`;
  };

  const selectSize = (sizeId) => {
    sizeInput.value = sizeId;
    chipsEl.querySelectorAll(".size-chip").forEach((chip) => {
      const on = chip.dataset.size === sizeId;
      chip.classList.toggle("is-selected", on);
      chip.setAttribute("aria-checked", on ? "true" : "false");
    });
    updateTotal();
  };

  POSTER_SIZES.forEach((s) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "size-chip";
    chip.dataset.size = s.id;
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", "false");
    chip.innerHTML = `
      <span class="size-chip-size">${escapeHtml(s.label)}</span>
      <span class="size-chip-price">€${s.price}</span>
    `;
    chip.addEventListener("click", () => selectSize(s.id));
    chipsEl.appendChild(chip);
  });

  selectSize(DEFAULT_SIZE);
  qtyInput.addEventListener("input", updateTotal);

  document.getElementById("orderClose").addEventListener("click", () => dialog.close());
  document.getElementById("orderDone").addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    form.reset();
    qtyInput.value = "1";
    selectSize(DEFAULT_SIZE);
    errorEl.hidden = true;
    errorEl.textContent = "";
    submitBtn.disabled = false;
    submitBtn.textContent = "Place order";
    formView.hidden = false;
    confirmView.hidden = true;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!ORDER_ENDPOINT) {
      errorEl.textContent =
        "Orders are not connected yet. Add your Google Apps Script URL to ORDER_ENDPOINT in script.js.";
      errorEl.hidden = false;
      return;
    }

    const quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const size = sizeInput.value;
    const unitPrice = priceForSize(size);
    const payload = {
      poster: document.getElementById("orderPosterTitle").value,
      size,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      name: document.getElementById("orderName").value.trim(),
      email: document.getElementById("orderEmail").value.trim(),
      phone: document.getElementById("orderPhone").value.trim(),
      street: document.getElementById("orderStreet").value.trim(),
      city: document.getElementById("orderCity").value.trim(),
      postal: document.getElementById("orderPostal").value.trim(),
      country: document.getElementById("orderCountry").value.trim(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      const res = await fetch(ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok || !data.confirmationCode) {
        throw new Error(data.error || "Order failed");
      }

      confirmCode.textContent = data.confirmationCode;
      document.getElementById("orderConfirmTotal").textContent = `€${payload.total}`;
      formView.hidden = true;
      confirmView.hidden = false;
    } catch (err) {
      errorEl.textContent = "Could not place order. Please try again in a moment.";
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Place order";
      console.error(err);
    }
  });
}

function openOrderDialog({ title, image }) {
  const dialog = document.getElementById("orderDialog");
  if (!dialog) return;

  document.getElementById("orderPosterImg").src = image;
  document.getElementById("orderPosterImg").alt = title;
  document.getElementById("orderDialogTitle").textContent = title;
  document.getElementById("orderPosterTitle").value = title;
  document.querySelectorAll("#orderSizeChips .size-chip").forEach((chip) => {
    const on = chip.dataset.size === DEFAULT_SIZE;
    chip.classList.toggle("is-selected", on);
    chip.setAttribute("aria-checked", on ? "true" : "false");
  });
  const sizeInput = document.getElementById("orderSize");
  if (sizeInput) sizeInput.value = DEFAULT_SIZE;
  const unit = priceForSize(DEFAULT_SIZE);
  document.getElementById("orderUnitPrice").textContent = `€${unit} per print`;
  document.getElementById("orderTotal").textContent = `€${unit}`;

  document.getElementById("orderFormView").hidden = false;
  document.getElementById("orderConfirmView").hidden = true;

  dialog.showModal();
}
