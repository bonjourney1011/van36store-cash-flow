/**
 * Reads and writes the Config / May / SoTien / Snapshot tabs of the bound spreadsheet.
 * Rows become objects keyed by the headers in domain-constants.gs; columns are matched by position.
 */
// Kept as text so Sheets never drops a leading 0 or turns a code into a number/date.
var FORCED_TEXT_FIELDS = ['imei5', 'ma_van_don'];

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Thiếu tab "' + name + '". Chạy setupSheets() trước.');
  return sheet;
}

function readRows_(sheet, width) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, width).getValues();
}

function rowToObject_(headers, row) {
  var item = {};
  headers.forEach(function (header, index) {
    var value = row[index];
    item[header] = typeof value === 'string' ? value.replace(/^'/, '').trim() : value;
  });
  return item;
}

function objectToRow_(headers, item) {
  return headers.map(function (header) {
    var value = item[header];
    if (value == null) return '';
    if (FORCED_TEXT_FIELDS.indexOf(header) !== -1 && value !== '') return "'" + String(value);
    return sanitizeCell(value);
  });
}

/** Config tab: column A = key, column B = value, merged over CONFIG_DEFAULTS. */
function readConfig() {
  var raw = {};
  readRows_(getSheet_(SHEET_NAMES.config), 2).forEach(function (row) {
    var key = String(row[0]).trim();
    if (key) raw[key] = row[1];
  });
  return resolveConfig(raw);
}

function readMachines() {
  return readRows_(getSheet_(SHEET_NAMES.machines), MACHINE_HEADERS.length)
    .map(function (row, index) {
      var machine = rowToObject_(MACHINE_HEADERS, row);
      machine.ma_may = String(machine.ma_may).toUpperCase();
      machine._row = index + 2;
      return machine;
    })
    .filter(function (machine) { return machine.ma_may; });
}

function readLedger() {
  return readRows_(getSheet_(SHEET_NAMES.ledger), LEDGER_HEADERS.length)
    .map(function (row) { return rowToObject_(LEDGER_HEADERS, row); })
    .filter(function (row) { return row.loai; });
}

function readSnapshots() {
  return readRows_(getSheet_(SHEET_NAMES.snapshots), SNAPSHOT_HEADERS.length)
    .map(function (row) { return rowToObject_(SNAPSHOT_HEADERS, row); })
    .filter(function (row) { return isValidDate(row.ngay); });
}

function readState() {
  return { config: readConfig(), machines: readMachines(), ledger: readLedger(), snapshots: readSnapshots() };
}

/** Stored counter, so deleting a test row never makes a machine code repeat. Call inside the lock. */
function peekNextMachineCode(machines) {
  var next = (Number(PropertiesService.getScriptProperties().getProperty('MACHINE_SEQ')) || 0) + 1;
  // Skip codes typed into the Sheet by hand, so two machines never share one.
  var used = {};
  machines.forEach(function (m) { used[m.ma_may] = true; });
  while (used['M' + pad(next, 4)]) next += 1;
  return 'M' + pad(next, 4);
}

function commitMachineCode(code) {
  PropertiesService.getScriptProperties().setProperty('MACHINE_SEQ', String(Number(code.slice(1))));
}

/**
 * Writes a planned action. Ledger rows go first in one batch: if a later write fails, the cash
 * book is still right and the weekly reconcile shows nothing missing.
 */
function applyPlan(plan, machines, now) {
  if (plan.ledgerRows.length) {
    var ledgerSheet = getSheet_(SHEET_NAMES.ledger);
    ledgerSheet.getRange(ledgerSheet.getLastRow() + 1, 1, plan.ledgerRows.length, LEDGER_HEADERS.length)
      .setValues(plan.ledgerRows.map(function (row) { return objectToRow_(LEDGER_HEADERS, row); }));
  }
  var machineSheet = getSheet_(SHEET_NAMES.machines);
  plan.newMachines.forEach(function (machine) {
    machine.cap_nhat_luc = now;
    machineSheet.appendRow(objectToRow_(MACHINE_HEADERS, machine));
  });
  plan.updates.forEach(function (update) {
    var current = machines.filter(function (m) { return m.ma_may === update.ma_may; })[0];
    var merged = Object.assign({}, current, update.changes, { cap_nhat_luc: now });
    machineSheet.getRange(current._row, 1, 1, MACHINE_HEADERS.length).setValues([objectToRow_(MACHINE_HEADERS, merged)]);
  });
}

/** One snapshot per day: a second run on the same day overwrites it. */
function writeSnapshot(today, buckets) {
  var sheet = getSheet_(SHEET_NAMES.snapshots);
  var row = [today, buckets.cash, buckets.receivable, buckets.stock, buckets.debt, buckets.equity];
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var lastDate = sheet.getRange(lastRow, 1).getValue();
    if (isValidDate(lastDate) && daysBetween(lastDate, today) === 0) {
      sheet.getRange(lastRow, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
}
