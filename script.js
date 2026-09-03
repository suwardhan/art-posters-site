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
        <img src="${imgSrc}" alt="${p.title}" loading="lazy" />
        <div class="card-overlay">
          <div class="card-info">
            <span class="card-title">${p.title}</span>
            <a class="btn-buy" href="${p.buyUrl}" target="_blank" rel="noreferrer">Buy Print</a>
          </div>
        </div>
      `;

      masonry.appendChild(card);
    });
  });
