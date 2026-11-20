// Walk Studio "Save to class" receiver. Paste into a Google Apps Script project bound to a Google Sheet.
// Each save becomes one row. The newest row per student wins when you collect.

var SHEET_NAME = 'Saves';

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(['Received', 'Student', 'Saved at', 'Rig version', 'Data']);
  return sh;
}

function doPost(e) {
  var out = { ok: false };
  try {
    var save = JSON.parse(e.postData.contents);
    if (save.format !== 'walkrig-save' || !/^S\d{2,3}$/.test(String(save.student))) throw new Error('Not a walk save');
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    sheet_().appendRow([new Date(), save.student, save.savedAt || '', save.rigVersion || '', JSON.stringify(save)]);
    lock.releaseLock();
    out = { ok: true, student: save.student };
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'walk-studio', rows: sheet_().getLastRow() - 1 }))
    .setMimeType(ContentService.MimeType.JSON);
}
