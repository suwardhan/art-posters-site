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
});

// ── Load posters ──
fetch("../posters.json")
  .then((res) => res.json())
  .then((posters) => {
    const masonry = document.getElementById("masonry");
    if (!masonry) return;

    posters.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card";

      const imgSrc = p.image.startsWith("images/") ? `../${p.image}` : p.image;

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

      masonry.appendChild(card);
    });
  });

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

function initOrderDialog() {
  const dialog = document.getElementById("orderDialog");
  if (!dialog) return;

  const form = document.getElementById("orderForm");
  const sizeSelect = document.getElementById("orderSize");
  const qtyInput = document.getElementById("orderQty");
  const totalEl = document.getElementById("orderTotal");
  const unitPriceEl = document.getElementById("orderUnitPrice");
  const errorEl = document.getElementById("orderError");
  const submitBtn = document.getElementById("orderSubmit");
  const formView = document.getElementById("orderFormView");
  const confirmView = document.getElementById("orderConfirmView");
  const confirmCode = document.getElementById("orderConfirmCode");

  POSTER_SIZES.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.label} — €${s.price}`;
    if (s.id === DEFAULT_SIZE) opt.selected = true;
    sizeSelect.appendChild(opt);
  });

  const updateTotal = () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const unit = priceForSize(sizeSelect.value);
    unitPriceEl.textContent = `€${unit} per print`;
    totalEl.textContent = `€${qty * unit}`;
  };

  qtyInput.addEventListener("input", updateTotal);
  sizeSelect.addEventListener("change", updateTotal);

  document.getElementById("orderClose").addEventListener("click", () => dialog.close());
  document.getElementById("orderDone").addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    form.reset();
    qtyInput.value = "1";
    updateTotal();
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
    const size = sizeSelect.value;
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
  const sizeSelect = document.getElementById("orderSize");
  if (sizeSelect) sizeSelect.value = DEFAULT_SIZE;
  const unit = priceForSize(DEFAULT_SIZE);
  document.getElementById("orderUnitPrice").textContent = `€${unit} per print`;
  document.getElementById("orderTotal").textContent = `€${unit}`;

  document.getElementById("orderFormView").hidden = false;
  document.getElementById("orderConfirmView").hidden = true;

  dialog.showModal();
}
