/**
 * Order intake for art-posters-site → Google Sheet "Orders" tab.
 *
 * After changing this file: Deploy → Manage deployments → Edit → New version.
 * First mail send will ask for Gmail permission.
 *
 * Mail is sent FROM the Google account that owns this script.
 * To send FROM chaudharykidiary@gmail.com, either:
 *   - deploy this script while logged in as that account, or
 *   - add it as a "Send mail as" alias on the owner Gmail, then use GmailApp with {from: ...}.
 */

var SHEET_NAME = "Orders";
var SHOP_EMAILS = "chaudharykidiary@gmail.com, suwardhan@gmail.com";
var REPLY_TO = "chaudharykidiary@gmail.com";
var FROM_NAME = "ChaudharykiDiary";

// Keep in sync with BANK_* in script.js.
var BANK_PAYEE_NAME = "Abhishek Chaudhary";
var BANK_IBAN = "DE11 1001 1001 2594 6138 16";
var BANK_BIC = "NTSBDEB1XXX";

/** Keep in sync with POSTER_SIZES in script.js */
var PRICE_BY_SIZE = {
  "5″×7″": 25,
  "6″×8″": 25,
  "8″×10″": 25,
  "8″×12″": 25,
  "8.27″×11.69″": 25,
  "9″×11″": 25,
  "10″×10″": 25,
  "8″×20″": 40,
  "10″×24″": 40,
  "11″×14″": 40,
  "11″×17″": 40,
  "11.69″×16.54″": 40,
  "12″×12″": 40,
  "12″×16″": 40,
  "12″×18″": 40,
  "14″×14″": 40,
  "16″×16″": 55,
  "16″×20″": 55,
  "16″×24″": 55,
  "18″×18″": 55,
  "18″×24″": 55,
  "A2 (16.5″×23.3″)": 55,
  "20″×20″": 55,
  "20″×24″": 55,
  "20″×28″": 75,
  "20″×30″": 75,
  "A1 (23.3″×33.1″)": 75,
  "24″×24″": 75,
  "24″×32″": 75,
  "24″×36″": 75,
  "28″×28″": 75,
  "28″×40″": 75,
  "30″×40″": 75,
};

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var size = String(data.size || "");
    if (!PRICE_BY_SIZE.hasOwnProperty(size)) {
      return json_({ ok: false, error: "Unknown size" });
    }

    var quantity = Math.max(1, parseInt(data.quantity, 10) || 1);
    var unitPrice = PRICE_BY_SIZE[size];
    var total = quantity * unitPrice;

    var sheet = getOrdersSheet_();
    ensureHeaders_(sheet);
    var code = nextConfirmationCode_(sheet);

    var order = {
      code: code,
      poster: String(data.poster || ""),
      size: size,
      quantity: quantity,
      unitPrice: unitPrice,
      total: total,
      name: String(data.name || ""),
      email: String(data.email || ""),
      phone: String(data.phone || ""),
      street: String(data.street || ""),
      city: String(data.city || ""),
      postal: String(data.postal || ""),
      country: String(data.country || ""),
    };

    sheet.appendRow([
      new Date(),
      order.code,
      order.poster,
      order.size,
      order.quantity,
      order.unitPrice,
      order.total,
      order.name,
      order.email,
      order.phone,
      order.street,
      order.city,
      order.postal,
      order.country,
      "New",
    ]);

    try {
      sendCustomerEmail_(order);
      sendShopAlert_(order);
    } catch (mailErr) {
      console.error("Mail failed: " + mailErr);
    }

    return json_({ ok: true, confirmationCode: code });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, message: "Poster order endpoint is live." });
}

function sendCustomerEmail_(order) {
  if (!order.email) return;
  MailApp.sendEmail({
    to: order.email,
    replyTo: REPLY_TO,
    name: FROM_NAME,
    subject: "Order " + order.code + " received - " + FROM_NAME,
    body:
      "Hi " +
      order.name +
      ",\n\n" +
      "We received your poster order.\n\n" +
      "Confirmation: " +
      order.code +
      "\n" +
      "Poster: " +
      order.poster +
      "\n" +
      "Size: " +
      order.size +
      "\n" +
      "Quantity: " +
      order.quantity +
      "\n" +
      "Total: €" +
      order.total +
      "\n\n" +
      "Delivery:\n" +
      order.street +
      "\n" +
      order.postal +
      " " +
      order.city +
      "\n" +
      order.country +
      "\n\n" +
      "Please pay €" +
      order.total +
      " so we can ship.\n\n" +
      (String(BANK_IBAN || "").replace(/\s+/g, "")
        ? "Bank transfer (SEPA / Girocode):\n" +
          "Name: " +
          BANK_PAYEE_NAME +
          "\n" +
          "IBAN: " +
          BANK_IBAN +
          (BANK_BIC ? "\nBIC: " + BANK_BIC : "") +
          "\nAmount: €" +
          order.total +
          "\nReference: " +
          order.code +
          "\n\n"
        : "") +
      "PayPal: https://www.paypal.me/chaudharikidiary\n" +
      "Put " +
      order.code +
      " in the payment note.\n\n" +
      "Once the amount is received, we'll ship in 3-5 business days.\n\n" +
      "Reply to this message if anything looks wrong.\n\n" +
      "- " +
      FROM_NAME,
  });
}

function sendShopAlert_(order) {
  MailApp.sendEmail({
    to: SHOP_EMAILS,
    replyTo: order.email || REPLY_TO,
    name: FROM_NAME,
    subject: "New poster order " + order.code + " - " + order.poster,
    body:
      "New order " +
      order.code +
      "\n\n" +
      "Poster: " +
      order.poster +
      "\n" +
      "Size: " +
      order.size +
      "\n" +
      "Quantity: " +
      order.quantity +
      "\n" +
      "Unit: €" +
      order.unitPrice +
      "\n" +
      "Total: €" +
      order.total +
      "\n\n" +
      "Customer: " +
      order.name +
      "\n" +
      "Email: " +
      order.email +
      "\n" +
      "Phone: " +
      order.phone +
      "\n\n" +
      "Delivery:\n" +
      order.street +
      "\n" +
      order.postal +
      " " +
      order.city +
      "\n" +
      order.country +
      "\n\n" +
      "Awaiting payment €" +
      order.total +
      " (bank transfer or PayPal @chaudharikidiary).\n" +
      "Ship 3-5 business days after payment is received.";
  });
}

function getOrdersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "Timestamp",
    "Confirmation",
    "Poster",
    "Size",
    "Quantity",
    "Unit Price",
    "Total",
    "Name",
    "Email",
    "Phone",
    "Street",
    "City",
    "Postal",
    "Country",
    "Status",
  ]);
  sheet.setFrozenRows(1);
}

/** Date-based codes: YYYYMMDD-001, YYYYMMDD-002, … */
function nextConfirmationCode_(sheet) {
  var tz = Session.getScriptTimeZone() || "Europe/Amsterdam";
  var dateStr = Utilities.formatDate(new Date(), tz, "yyyyMMdd");
  var prefix = dateStr + "-";
  var lastRow = sheet.getLastRow();
  var seq = 1;

  if (lastRow >= 2) {
    var codes = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < codes.length; i++) {
      var code = String(codes[i][0] || "");
      if (code.indexOf(prefix) === 0) {
        var n = parseInt(code.slice(prefix.length), 10);
        if (!isNaN(n) && n >= seq) seq = n + 1;
      }
    }
  }

  return prefix + ("000" + seq).slice(-3);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
