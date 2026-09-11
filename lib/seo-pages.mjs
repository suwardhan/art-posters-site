export const SITE_ORIGIN = "https://chaudharykidiary.com";
export const SITE_NAME = "ChaudharykiDiary";
export const ARTIST_NAME = "Abhishek Chaudhary";
export const INSTAGRAM_URL = "https://www.instagram.com/chaudharykidiary/";
export const DEFAULT_OG_PATH = "/images/dangal.jpg";
export const POSTER_BLURB =
  "Limited edition art print. Colour, form, and silence - made to live with you, not just to be looked at.";
export const DEFAULT_DESCRIPTION = `Limited edition art prints by ${ARTIST_NAME} at ${SITE_NAME}. Colour, form, and silence — made to live with you, not just to be looked at.`;

export const COLLECTIONS = [
  { id: "bollywood", title: "Bollywood movies" },
  { id: "furniture", title: "Furniture" },
  { id: "bathroom", title: "Bathroom" },
  { id: "abstract", title: "Abstract" },
  { id: "portraits", title: "Portraits" },
];

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function publishedPosters(posters) {
  return (posters || []).filter((p) => p && p.hidden !== true);
}

export function shopEnabled(poster) {
  return Boolean(poster) && poster.shop !== false;
}

export function shopPosters(posters) {
  return publishedPosters(posters).filter(shopEnabled);
}

export function assetPath(image) {
  const value = String(image || "").trim();
  if (!value) return DEFAULT_OG_PATH;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

export function absoluteUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

export const HOME_PATH = "/";
export const POSTERS_PATH = "/posters/";
export const ABOUT_PATH = "/about/";
export const SITE_NAV = [
  { id: "home", href: HOME_PATH, label: "Gallery" },
  { id: "prints", href: POSTERS_PATH, label: "Prints" },
  { id: "about", href: ABOUT_PATH, label: "About me" },
];

export function collectionUrl(id) {
  return `/collections/${id}/`;
}

export function printUrl(id) {
  return `/prints/${id}/`;
}

export function collectionById(id) {
  return COLLECTIONS.find((c) => c.id === id) || COLLECTIONS[0];
}

export function collectionCopy(collection) {
  if (collection.id === "bollywood") {
    return {
      h1: "Bollywood, reimagined.",
      copy: "Limited edition art prints of classic Indian cinema.",
    };
  }
  return {
    h1: `${collection.title}.`,
    copy: "Limited edition art prints.",
  };
}

function titlesSentence(items) {
  const names = items.map((p) => p.title).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function collectionSeo(collection, posters) {
  const items = publishedPosters(posters).filter(
    (p) => (p.collection || "bollywood") === collection.id
  );
  const copy = collectionCopy(collection);
  const listed = titlesSentence(items);
  let description;
  if (items.length && listed) {
    description = `${copy.copy} Buy ${listed} by ${ARTIST_NAME} at ${SITE_NAME}.`;
  } else {
    description = `${collection.title} art prints by ${ARTIST_NAME} at ${SITE_NAME}. Limited edition posters to live with, not just look at.`;
  }
  return {
    title: `${collection.title} art prints — ${SITE_NAME}`,
    description,
    h1: copy.h1,
    copy: copy.copy,
    items,
    ogImage: items[0] ? assetPath(items[0].image) : DEFAULT_OG_PATH,
  };
}

export function posterBlurb(poster) {
  const custom = String(poster?.blurb || "").trim();
  return custom || POSTER_BLURB;
}

export function posterSeo(poster) {
  const collection = collectionById(poster.collection);
  const blurb = posterBlurb(poster);
  return {
    title: `${poster.title} art print — ${SITE_NAME}`,
    description: `${poster.title} limited edition art print by ${ARTIST_NAME}. ${blurb}`,
    blurb,
    collection,
    image: assetPath(poster.image),
  };
}

function jsonLdScript(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function shareIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
}

export function posterCardHtml(poster, { buy } = {}) {
  const href = printUrl(poster.id);
  const imgSrc = assetPath(poster.image);
  const title = escapeHtml(poster.title);
  const showBuy = buy !== false && shopEnabled(poster);
  const buyBtn = showBuy
    ? `<button type="button" class="btn-buy" data-title="${title}" data-image="${escapeHtml(imgSrc)}">Buy Print</button>`
    : "";
  return `<article class="card" data-id="${escapeHtml(poster.id)}" data-title="${title}" data-image="${escapeHtml(imgSrc)}" data-shop="${shopEnabled(poster) ? "true" : "false"}" aria-expanded="false">
  <a class="card-hit" href="${href}">
    <img src="${escapeHtml(imgSrc)}" alt="${title}" loading="lazy" />
  </a>
  <div class="card-overlay">
    <div class="card-info">
      <a class="card-title" href="${href}">${title}</a>
      <div class="card-actions">
        ${buyBtn}
        <button type="button" class="btn-share" data-share-title="${title}" data-share-url="${href}" aria-label="Share ${title}">${shareIconSvg()}<span>Share</span></button>
      </div>
    </div>
  </div>
</article>`;
}

function headTags({ title, description, url, image, imageAlt, robots, ogType }) {
  const absUrl = absoluteUrl(url);
  const absImage = absoluteUrl(image || DEFAULT_OG_PATH);
  const desc = escapeHtml(description);
  const pageTitle = escapeHtml(title);
  const alt = escapeHtml(imageAlt || title);
  const type = escapeHtml(ogType || "website");
  const robotsTag = robots
    ? `\n  <meta name="robots" content="${escapeHtml(robots)}" />`
    : "";
  return `<meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${desc}" />${robotsTag}
  <link rel="canonical" href="${absUrl}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${absUrl}" />
  <meta property="og:image" content="${absImage}" />
  <meta property="og:image:alt" content="${alt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${absImage}" />
  <link rel="icon" href="/favicon.png" type="image/png" />
  <link rel="apple-touch-icon" href="/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <script>document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "light");</script>`;
}

function navHtml(activePageId) {
  const links = SITE_NAV.map((item) => {
    const on = item.id === activePageId;
    return `<a class="site-nav-link${on ? " is-active" : ""}" href="${item.href}"${on ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`;
  }).join("");

  return `<nav class="navbar">
    <a href="/" class="logo"><img class="logo-mark" src="/favicon.png" alt="" />${SITE_NAME}</a>
    <div class="nav-actions">
      <div class="site-nav" id="siteNav" aria-label="Site">${links}</div>
      <span class="nav-divider" aria-hidden="true"></span>
      <a
        class="theme-toggle"
        href="${INSTAGRAM_URL}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
      </a>
      <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
        <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button class="theme-toggle nav-menu-toggle" id="navToggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="siteNav">
        <svg class="icon-menu" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
        <svg class="icon-close" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
      </button>
    </div>
  </nav>`;
}

function footerHtml() {
  return `<footer>
    <p>&copy; 2026 ${SITE_NAME}</p>
    <p class="footer-credit">Art prints by ${ARTIST_NAME}</p>
  </footer>`;
}

function orderDialogHtml() {
  return `<dialog id="orderDialog" class="order-dialog" aria-modal="true" aria-labelledby="orderHeading">
    <div class="order-panel">
    <header class="order-header">
      <h2 id="orderHeading">Place an order</h2>
      <button type="button" class="order-close" id="orderClose" aria-label="Close">&times;</button>
    </header>

    <div class="order-layout" id="orderLayout">
        <div class="order-sidebar">
        <aside class="order-preview">
          <img id="orderPosterImg" src="" alt="" />
          <h2 id="orderDialogTitle" class="order-poster-title"></h2>
          <p class="order-unit-price" id="orderUnitPrice">€40 per print</p>
        </aside>

        <section class="order-faq" id="orderFaq" aria-label="Order FAQ">
          <h3 class="order-faq-heading">Questions before you order</h3>
          <details class="order-faq-item">
            <summary>How do I pay?</summary>
            <p>
              Place the order first, then pay directly by SEPA bank transfer or via PayPal
              (<a href="https://www.paypal.me/AbhishekChaudhary454" target="_blank" rel="noopener noreferrer">@AbhishekChaudhary454</a>).
              Put your confirmation code in the transfer reference or PayPal note so we can match it.
            </p>
          </details>
          <details class="order-faq-item">
            <summary>When will it ship?</summary>
            <p>
              After we receive your payment, we ship in 3–5 business days.
              You'll get a confirmation email when the order is placed.
            </p>
          </details>
          <details class="order-faq-item">
            <summary>Can I order more than one size?</summary>
            <p>
              Each order is for one poster and one size. To get another size
              (or a different poster), place a separate order.
            </p>
          </details>
          <details class="order-faq-item">
            <summary>Need help?</summary>
            <p>
              Reply to your confirmation email, or write to
              <a href="mailto:chaudharykidiary@gmail.com">chaudharykidiary@gmail.com</a>.
            </p>
          </details>
        </section>
        </div>

        <div class="order-form-view" id="orderFormView">
        <form id="orderForm" class="order-form" novalidate>
          <input type="hidden" id="orderPosterTitle" name="poster" />

          <fieldset class="order-fieldset">
            <legend>Print</legend>
            <div class="order-row">
              <span class="order-size-heading" id="orderSizeLabel">Size</span>
              <div
                class="size-chips"
                id="orderSizeChips"
                role="radiogroup"
                aria-labelledby="orderSizeLabel"
              ></div>
              <input type="hidden" id="orderSize" name="size" required />
            </div>
            <div class="order-row">
              <label for="orderQty">Quantity</label>
              <input type="number" id="orderQty" name="quantity" min="1" max="20" value="1" required />
            </div>
          </fieldset>

          <fieldset class="order-fieldset">
            <legend>Contact</legend>
            <div class="order-row">
              <label for="orderName">Full name</label>
              <input type="text" id="orderName" name="name" autocomplete="name" required />
            </div>
            <div class="order-row">
              <label for="orderEmail">Email</label>
              <input type="email" id="orderEmail" name="email" autocomplete="email" required />
            </div>
            <div class="order-row">
              <label for="orderPhone">Phone</label>
              <input type="tel" id="orderPhone" name="phone" autocomplete="tel" required />
            </div>
          </fieldset>

          <fieldset class="order-fieldset">
            <legend>Delivery</legend>
            <div class="order-row">
              <label for="orderStreet">Street address</label>
              <input type="text" id="orderStreet" name="street" autocomplete="street-address" required />
            </div>
            <div class="order-row order-row-split">
              <div>
                <label for="orderCity">City</label>
                <input type="text" id="orderCity" name="city" autocomplete="address-level2" required />
              </div>
              <div>
                <label for="orderPostal">Postal code</label>
                <input type="text" id="orderPostal" name="postal" autocomplete="postal-code" required />
              </div>
            </div>
            <div class="order-row">
              <label for="orderCountry">Country</label>
              <select id="orderCountry" name="country" autocomplete="country-name" required>
                <option value="">Select country</option>
              </select>
            </div>
          </fieldset>

          <div class="order-total-bar">
            <span>Total</span>
            <strong id="orderTotal">€40</strong>
          </div>

          <p class="order-error" id="orderError" hidden></p>

          <button type="submit" class="order-submit" id="orderSubmit">Place order</button>
          <p class="order-note">You'll get a confirmation email. Pay by bank transfer or PayPal to complete the order.</p>
        </form>
        </div>

        <div class="order-confirm-view" id="orderConfirmView" hidden>
          <div class="order-confirm">
            <div class="order-confirm-header">
              <p class="order-confirm-label">Order received</p>
              <h2 class="order-confirm-code" id="orderConfirmCode"></h2>
              <p class="order-confirm-copy">A confirmation email is on its way.</p>
            </div>

            <div class="order-confirm-pay">
              <p class="order-confirm-label">Payment pending</p>
              <p class="order-confirm-copy">
                Pay <strong id="orderConfirmTotal">€0</strong> with one of the options below.
                Put your confirmation code in the payment reference so we can match it.
              </p>
            </div>

            <div class="order-pay-methods" id="orderPayOptions">
              <section class="order-pay-method" id="orderBankPay" data-pay="bank" hidden>
                <button type="button" class="order-pay-method-toggle" aria-expanded="false">
                  <span class="order-pay-method-copy">
                    <span class="order-pay-card-title">Pay directly</span>
                    <span class="order-pay-card-copy">SEPA bank transfer</span>
                  </span>
                </button>
                <div class="order-pay-method-panel">
                  <div class="order-pay-method-clip">
                  <div class="order-pay-method-body">
                    <p class="order-pay-test" id="orderPayTestNote" hidden>
                      Sample bank details for layout — do not send money here.
                    </p>
                    <p class="order-pay-card-copy">Scan with your banking app, or copy the details.</p>
                    <div class="order-pay-qr" id="orderGirocode"></div>
                    <dl class="order-bank-details">
                      <div>
                        <dt>Name</dt>
                        <dd id="orderBankName"></dd>
                      </div>
                      <div>
                        <dt>IBAN</dt>
                        <dd>
                          <span id="orderBankIban"></span>
                          <button type="button" class="order-copy" data-copy-target="orderBankIban">Copy</button>
                        </dd>
                      </div>
                      <div id="orderBankBicRow" hidden>
                        <dt>BIC</dt>
                        <dd id="orderBankBic"></dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd id="orderBankAmount"></dd>
                      </div>
                      <div>
                        <dt>Reference</dt>
                        <dd>
                          <span id="orderBankReference"></span>
                          <button type="button" class="order-copy" data-copy-target="orderBankReference">Copy</button>
                        </dd>
                      </div>
                    </dl>
                  </div>
                  </div>
                </div>
              </section>

              <section class="order-pay-method" id="orderPaypalPay" data-pay="paypal">
                <button type="button" class="order-pay-method-toggle" aria-expanded="false">
                  <span class="order-pay-method-copy">
                    <span class="order-pay-card-title">Pay via PayPal</span>
                    <span class="order-pay-card-copy">@AbhishekChaudhary454</span>
                  </span>
                </button>
                <div class="order-pay-method-panel">
                  <div class="order-pay-method-clip">
                  <div class="order-pay-method-body">
                    <p class="order-pay-card-copy">Scan with the PayPal app, or open PayPal and add the confirmation code in the note.</p>
                    <div class="order-pay-qr order-pay-qr--paypal">
                      <img src="/images/paypal-qr.png" alt="PayPal payment QR code" width="338" height="342">
                    </div>
                    <dl class="order-bank-details">
                      <div>
                        <dt>Account</dt>
                        <dd>@AbhishekChaudhary454</dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd id="orderPaypalAmount"></dd>
                      </div>
                      <div>
                        <dt>Note</dt>
                        <dd>
                          <span id="orderPaypalNote"></span>
                          <button type="button" class="order-copy" data-copy-target="orderPaypalNote">Copy</button>
                        </dd>
                      </div>
                    </dl>
                    <a
                      class="order-paypal"
                      id="orderPaypalLink"
                      href="https://www.paypal.me/AbhishekChaudhary454"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open PayPal
                    </a>
                  </div>
                  </div>
                </div>
              </section>
            </div>

            <p class="order-alert" role="status">
              Once the amount is received, we'll ship in 3-5 business days.
            </p>
            <button type="button" class="order-submit" id="orderDone">Done</button>
          </div>
        </div>
    </div>
    </div>
  </dialog>`;
}

function pageScripts() {
  return `<script src="/vendor/qrcode.min.js"></script>
  <script src="/script.js"></script>`;
}

function pressSectionHtml() {
  return `<section class="home-press" aria-labelledby="pressHeading">
      <h2 class="home-kicker" id="pressHeading">Press</h2>
      <div class="press-cards">
        <a
          class="press-card"
          href="https://www.thehindu.com/entertainment/movies/how-designer-abhishek-chaudhary-is-adding-a-quirky-punch-to-bollywood-movie-posters/article71391746.ece"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img class="press-thumb" src="/images/press/the-hindu-preview.jpg" alt="" />
          <span class="press-copy">
            <span class="press-source">The Hindu</span>
            <span class="press-title">How designer Abhishek Chaudhary is adding a quirky punch to Bollywood movie posters</span>
            <img class="press-logo press-logo--hindu" src="/images/press/the-hindu.png" alt="" aria-hidden="true" />
          </span>
        </a>
        <a
          class="press-card"
          href="https://homegrown.co.in/homegrown-creators/abhishek-chaudharys-movie-posters-feel-like-inside-jokes-for-cinephiles"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img class="press-thumb" src="/images/press/homegrown-preview.jpg" alt="" />
          <span class="press-copy">
            <span class="press-source">Homegrown</span>
            <span class="press-title">Abhishek Chaudhary's movie posters feel like inside jokes for cinephiles</span>
            <img class="press-logo press-logo--homegrown" src="/images/press/homegrown.png" alt="" aria-hidden="true" />
          </span>
        </a>
        <a
          class="press-card"
          href="https://www.socialketchup.in/creators/abhishek-chaudhary-art-12483702"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img class="press-thumb" src="/images/press/social-ketchup-preview.jpg" alt="" />
          <span class="press-copy">
            <span class="press-source">Social Ketchup</span>
            <span class="press-title">In art, the subject matters less to Abhishek Chaudhary than the curiosity it sparks</span>
            <img class="press-logo press-logo--ketchup" src="/images/press/social-ketchup.png" alt="" aria-hidden="true" />
          </span>
        </a>
      </div>
    </section>`;
}

function allPrintsSeo(posters, { shopOnly = false } = {}) {
  const items = shopOnly ? shopPosters(posters) : publishedPosters(posters);
  const listed = titlesSentence(shopOnly ? items : shopPosters(posters));
  const description = listed
    ? `Limited edition art prints by ${ARTIST_NAME}. Buy ${listed} at ${SITE_NAME}.`
    : DEFAULT_DESCRIPTION;
  return {
    items,
    description,
    ogImage: items[0] ? assetPath(items[0].image) : DEFAULT_OG_PATH,
    itemList: {
      "@type": "ItemList",
      itemListElement: items.map((poster, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(printUrl(poster.id)),
        name: poster.title,
      })),
    },
  };
}

export function renderHomePage(posters) {
  const seo = allPrintsSeo(posters);
  const cards = seo.items.map((poster) => posterCardHtml(poster, { buy: false })).join("\n      ");
  const jsonLd = jsonLdScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_ORIGIN + "/",
        description: DEFAULT_DESCRIPTION,
      },
      {
        "@type": "Person",
        name: ARTIST_NAME,
        url: SITE_ORIGIN + "/",
        sameAs: [INSTAGRAM_URL],
      },
      seo.itemList,
    ],
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${headTags({
    title: `${SITE_NAME} — Art prints by ${ARTIST_NAME}`,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    image: seo.ogImage,
    imageAlt: seo.items[0]?.title || SITE_NAME,
  })}
  ${jsonLd}
</head>
<body data-gallery="home">
  ${navHtml("home")}

  <section class="home-hero">
    <div class="home-hero-copy">
      <h1>Art is a way of paying attention.</h1>
      <p>Colour, form, and silence - made to live with you, not just to be looked at.</p>
    </div>
  </section>

  <main>
    <div id="masonry" class="masonry">
      ${cards}
    </div>
  </main>

  ${footerHtml()}
  ${orderDialogHtml()}
  ${pageScripts()}
</body>
</html>
`;
}

export function renderPostersPage(posters) {
  const seo = allPrintsSeo(posters, { shopOnly: true });
  const cards = seo.items.map(posterCardHtml).join("\n      ");
  const pageTitle = `Prints — ${SITE_NAME}`;
  const jsonLd = jsonLdScript({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    description: seo.description,
    url: absoluteUrl(POSTERS_PATH),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_ORIGIN + "/",
    },
    about: {
      "@type": "Person",
      name: ARTIST_NAME,
      url: SITE_ORIGIN + "/",
      sameAs: [INSTAGRAM_URL],
    },
    mainEntity: seo.itemList,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${headTags({
    title: pageTitle,
    description: seo.description,
    url: POSTERS_PATH,
    image: seo.ogImage,
    imageAlt: seo.items[0]?.title || "Prints",
  })}
  ${jsonLd}
</head>
<body data-gallery="shop">
  ${navHtml("prints")}

  <header class="hero">
    <div class="hero-inner">
      <h1>Prints.</h1>
      <p>Limited edition art prints.</p>
    </div>
  </header>

  <main>
    <div id="masonry" class="masonry">
      ${cards}
    </div>
  </main>

  ${footerHtml()}
  ${orderDialogHtml()}
  ${pageScripts()}
</body>
</html>
`;
}

export function renderAboutPage() {
  const pageTitle = `About me — ${SITE_NAME}`;
  const description =
    "Abhishek Chaudhary is an illustrator and visual artist based in Berlin, working across illustration, visual storytelling, and design.";
  const jsonLd = jsonLdScript({
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: pageTitle,
    description,
    url: absoluteUrl(ABOUT_PATH),
    about: {
      "@type": "Person",
      name: ARTIST_NAME,
      url: SITE_ORIGIN + "/",
      sameAs: [INSTAGRAM_URL],
      description,
    },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${headTags({
    title: pageTitle,
    description,
    url: ABOUT_PATH,
    image: "/images/about.jpg",
    imageAlt: ARTIST_NAME,
  })}
  ${jsonLd}
</head>
<body>
  ${navHtml("about")}

  <main class="about-main">
    <section class="about-intro">
      <div class="about-copy">
        <h1>About me</h1>
        <p>Abhishek Chaudhary is an illustrator and visual artist based in Berlin, working across illustration, visual storytelling, and design. His practice is rooted in curiosity and a fascination with culture, people, objects, and the small details of everyday life.</p>
        <p>Through bold forms, expressive characters, and playful visual language, he creates work that sits between art, design, and storytelling. His independent practice, Chaudhary Ki Diary, is a space where ideas become images and experimentation becomes part of the process.</p>
      </div>
      <div class="about-photo">
        <img src="/images/about.jpg" alt="${ARTIST_NAME}" />
      </div>
    </section>
    ${pressSectionHtml()}
  </main>

  ${footerHtml()}
  <script src="/script.js"></script>
</body>
</html>
`;
}

export function renderCollectionPage(collection, posters) {
  const seo = collectionSeo(collection, posters);
  const cards = seo.items.map(posterCardHtml).join("\n      ");
  const jsonLd = jsonLdScript({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: seo.title,
    description: seo.description,
    url: absoluteUrl(collectionUrl(collection.id)),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_ORIGIN + "/",
    },
    about: {
      "@type": "Person",
      name: ARTIST_NAME,
      url: SITE_ORIGIN + "/",
      sameAs: [INSTAGRAM_URL],
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: seo.items.map((poster, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(printUrl(poster.id)),
        name: poster.title,
      })),
    },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${headTags({
    title: seo.title,
    description: seo.description,
    url: collectionUrl(collection.id),
    image: seo.ogImage,
    imageAlt: seo.items[0]?.title || collection.title,
    robots: seo.items.length ? undefined : "noindex, follow",
  })}
  ${jsonLd}
</head>
<body data-collection="${collection.id}">
  ${navHtml("prints")}

  <header class="hero">
    <div class="hero-inner">
      <h1 id="collectionHeroTitle">${escapeHtml(seo.h1)}</h1>
      <p id="collectionHeroCopy">${escapeHtml(seo.copy)}</p>
    </div>
  </header>

  <main>
    <div id="masonry" class="masonry">
      ${cards}
    </div>
  </main>

  ${footerHtml()}
  ${orderDialogHtml()}
  ${pageScripts()}
</body>
</html>
`;
}

function relatedPosters(poster, posters) {
  const collectionId = collectionById(poster.collection).id;
  return publishedPosters(posters).filter(
    (p) => (p.collection || "bollywood") === collectionId && p.id !== poster.id
  );
}

function relatedSectionHtml(poster, posters) {
  const items = relatedPosters(poster, posters);
  if (!items.length) return "";
  const collection = collectionById(poster.collection);
  return `<section class="print-related" id="printRelated" aria-labelledby="relatedHeading">
    <h2 class="home-kicker" id="relatedHeading">More from ${escapeHtml(collection.title)}</h2>
    <div id="relatedMasonry" class="masonry">
      ${items.map(posterCardHtml).join("\n      ")}
    </div>
  </section>`;
}

export function renderPrintPage(poster, posters = []) {
  const seo = posterSeo(poster);
  const href = printUrl(poster.id);
  const imgSrc = seo.image;
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${poster.title} art print`,
    description: seo.description,
    image: absoluteUrl(imgSrc),
    url: absoluteUrl(href),
    brand: { "@type": "Brand", name: SITE_NAME },
    creator: {
      "@type": "Person",
      name: ARTIST_NAME,
      url: SITE_ORIGIN + "/",
      sameAs: [INSTAGRAM_URL],
    },
  };
  if (shopEnabled(poster)) {
    product.offers = {
      "@type": "AggregateOffer",
      lowPrice: "25",
      highPrice: "75",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(href),
    };
  }
  const jsonLd = jsonLdScript(product);
  const crumbs = jsonLdScript({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_ORIGIN + "/" },
      {
        "@type": "ListItem",
        position: 2,
        name: seo.collection.title,
        item: absoluteUrl(collectionUrl(seo.collection.id)),
      },
      { "@type": "ListItem", position: 3, name: poster.title, item: absoluteUrl(href) },
    ],
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${headTags({
    title: seo.title,
    description: seo.description,
    url: href,
    image: imgSrc,
    imageAlt: poster.title,
    ogType: "product",
  })}
  ${jsonLd}
  ${crumbs}
</head>
<body data-collection="${seo.collection.id}" data-poster-id="${escapeHtml(poster.id)}" data-shop="${shopEnabled(poster) ? "true" : "false"}">
  ${navHtml("prints")}

  <main>
  <div class="print-page">
    <figure class="print-media">
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(poster.title)}" />
    </figure>
    <div class="print-copy">
      <p class="print-kicker"><a href="${collectionUrl(seo.collection.id)}">${escapeHtml(seo.collection.title)}</a></p>
      <h1>${escapeHtml(poster.title)}</h1>
      <p class="print-blurb">${escapeHtml(seo.blurb)}</p>
      ${shopEnabled(poster) ? `<p class="print-price">From €25</p>` : ""}
      <div class="print-actions">
        ${shopEnabled(poster) ? `<button type="button" class="btn-buy" data-title="${escapeHtml(poster.title)}" data-image="${escapeHtml(imgSrc)}">Buy Print</button>` : ""}
        <button type="button" class="btn-share" data-share-title="${escapeHtml(poster.title)}" data-share-url="${href}">${shareIconSvg()}<span>Share</span></button>
      </div>
    </div>
  </div>
  ${relatedSectionHtml(poster, posters)}
  </main>

  ${footerHtml()}
  ${orderDialogHtml()}
  ${pageScripts()}
</body>
</html>
`;
}

export function renderSitemap(posters) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    "/",
    POSTERS_PATH,
    ABOUT_PATH,
    ...COLLECTIONS.filter((c) => collectionSeo(c, posters).items.length).map((c) =>
      collectionUrl(c.id)
    ),
    ...publishedPosters(posters).map((p) => printUrl(p.id)),
  ];
  const body = urls
    .map(
      (path) => `  <url>
    <loc>${absoluteUrl(path)}</loc>
    <lastmod>${today}</lastmod>
  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

export function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Page not found — ${SITE_NAME}</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" href="/favicon.png" type="image/png" />
  <link rel="stylesheet" href="/styles.css" />
  <script>document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "light");</script>
</head>
<body>
  ${navHtml()}
  <main class="print-page print-page--narrow">
    <div class="print-copy">
      <h1>Page not found</h1>
      <p class="print-blurb">That print or collection is not here. Browse the shop instead.</p>
      <p><a href="${POSTERS_PATH}">View prints</a></p>
    </div>
  </main>
  <script src="/script.js"></script>
</body>
</html>
`;
}

export function catalogArray(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.posters) ? data.posters : [];
}

export function seoFilesFromCatalog(posters, { existingPrintIds = [] } = {}) {
  const list = Array.isArray(posters) ? posters : catalogArray(posters);
  const visible = publishedPosters(list);
  const visibleIds = new Set(visible.map((p) => p.id));
  const upserts = [
    { path: "robots.txt", content: renderRobots() },
    { path: "sitemap.xml", content: renderSitemap(list) },
    { path: "404.html", content: renderNotFound() },
    { path: "index.html", content: renderHomePage(list) },
    { path: "posters/index.html", content: renderPostersPage(list) },
    { path: "about/index.html", content: renderAboutPage() },
  ];

  for (const collection of COLLECTIONS) {
    upserts.push({
      path: `collections/${collection.id}/index.html`,
      content: renderCollectionPage(collection, list),
    });
  }

  for (const poster of visible) {
    upserts.push({
      path: `prints/${poster.id}/index.html`,
      content: renderPrintPage(poster, list),
    });
  }

  const deletions = existingPrintIds
    .filter((id) => id && !visibleIds.has(id))
    .map((id) => `prints/${id}/index.html`);

  return { upserts, deletions };
}
