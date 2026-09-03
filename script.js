// Paste your Google Apps Script web app URL after deploying (see apps-script/Code.gs).
const ORDER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzzRpEg24-bgleWh7k97SSnkgtiMmIOZrEd5cOA88Xv3v11oHH3QWhi_USdD6LQ8dE-0Q/exec";

const UNIT_PRICE_EUR = 35;

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
  const qtyInput = document.getElementById("orderQty");
  const totalEl = document.getElementById("orderTotal");
  const errorEl = document.getElementById("orderError");
  const submitBtn = document.getElementById("orderSubmit");
  const formView = document.getElementById("orderFormView");
  const confirmView = document.getElementById("orderConfirmView");
  const confirmCode = document.getElementById("orderConfirmCode");

  const updateTotal = () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    totalEl.textContent = `€${qty * UNIT_PRICE_EUR}`;
  };

  qtyInput.addEventListener("input", updateTotal);

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
    const payload = {
      poster: document.getElementById("orderPosterTitle").value,
      size: document.getElementById("orderSize").value,
      quantity,
      unitPrice: UNIT_PRICE_EUR,
      total: quantity * UNIT_PRICE_EUR,
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
  document.getElementById("orderTotal").textContent = `€${UNIT_PRICE_EUR}`;

  document.getElementById("orderFormView").hidden = false;
  document.getElementById("orderConfirmView").hidden = true;

  dialog.showModal();
}
