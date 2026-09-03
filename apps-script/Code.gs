/**
 * Order intake for art-posters-site → Google Sheet "Orders" tab.
 *
 * SETUP
 * 1. Open your spreadsheet:
 *    https://docs.google.com/spreadsheets/d/16Doxlbfjy8Pz4djk12eq77FTgk4Cc0zZpmzY3RK4Tc0/edit
 * 2. Create a new sheet tab named exactly: Orders
 * 3. Extensions → Apps Script
 * 4. Delete any default code and paste this entire file
 * 5. Deploy → New deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Authorize, copy the Web app URL
 * 7. Paste that URL into ORDER_ENDPOINT in script.js
 *
 * Sheet columns (row 1 headers are created automatically on first order):
 * Timestamp | Confirmation | Poster | Size | Quantity | Unit Price | Total |
 * Name | Email | Phone | Street | City | Postal | Country | Status
 */

var SHEET_NAME = "Orders";
var UNIT_PRICE = 35;

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getOrdersSheet_();
    ensureHeaders_(sheet);

    var quantity = Math.max(1, parseInt(data.quantity, 10) || 1);
    var unitPrice = Number(data.unitPrice) || UNIT_PRICE;
    var total = quantity * unitPrice;
    var code = nextConfirmationCode_(sheet);

    sheet.appendRow([
      new Date(),
      code,
      String(data.poster || ""),
      String(data.size || ""),
      quantity,
      unitPrice,
      total,
      String(data.name || ""),
      String(data.email || ""),
      String(data.phone || ""),
      String(data.street || ""),
      String(data.city || ""),
      String(data.postal || ""),
      String(data.country || ""),
      "New",
    ]);

    return json_({ ok: true, confirmationCode: code });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, message: "Poster order endpoint is live." });
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
    var codes = sheet.getRange(2, 2, lastRow, 2).getValues();
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
