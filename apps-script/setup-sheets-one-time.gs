/**
 * Run once from the Apps Script editor (select setupSheets → Run).
 * Creates the Config / May / SoTien / Snapshot tabs if they are missing. Existing tabs are left untouched.
 */
var CONFIG_NOTES = {
  nhom_may: 'Các nhóm máy, cách nhau dấu phẩy. Thêm nhóm mới thì thêm dòng canh_bao_ton_ngay_<tên nhóm không dấu>.',
  von_dem_pct: 'Tiền luôn giữ lại (tỷ lệ vốn chủ) để xoay sở / ăn deal. 0.15 = 15%.',
  tran_1_may_pct: 'Một máy mua mới tối đa bao nhiêu % vốn chủ. 0.3 = 30%.',
  may_lon_pct: 'Máy chiếm từ mức này trở lên được coi là "máy vốn lớn".',
  ngay_giu_toi_da_may_lon: 'Máy vốn lớn giữ quá số ngày này sẽ bị nhắc xả.',
  canh_bao_ton_ngay_iphone: 'iPhone tồn quá số ngày này sẽ được gợi ý hạ giá.',
  canh_bao_ton_ngay_laptop: 'Laptop tồn quá số ngày này sẽ được gợi ý hạ giá.',
  canh_bao_ton_ngay_mac_dinh: 'Hạn tồn cho các nhóm chưa có dòng riêng.',
  cod_canh_bao_ngay: 'Đơn COD gửi quá số ngày này mà chưa có tiền sẽ bị nhắc.',
  han_no_moi_mac_dinh: 'Số ngày mối được nợ nếu không ghi hạn trả.',
  buoc_ha_gia_pct: 'Mỗi bậc gợi ý hạ giá. 0.03 = 3%.',
  r_mac_dinh: 'Lãi/ngày trên 1 đồng vốn dùng tạm khi chưa đủ 5 máy bán xong. 0.003 = 0,3%/ngày.',
  mat_gia_thang_pct: 'Máy cũ mất giá thị trường mỗi tháng (ước tính). 0.03 = 3%/tháng.',
  ton_kho_toi_da_pct: 'Tiền nằm trong máy tồn vượt tỷ lệ vốn chủ này sẽ bị nhắc.',
  doi_chieu_moi_ngay: 'Nhắc đối chiếu số dư sau số ngày này.',
  hang_van_chuyen: 'Các hãng vận chuyển hiện trong form, cách nhau dấu phẩy.',
  site_url: 'Link trang GitHub Pages, VD https://ten.github.io/dong-tien-may-cu/ (để tạo link riêng cho anh).'
};

function setupSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  // Date cells are read in the spreadsheet's time zone, not the script's.
  spreadsheet.setSpreadsheetTimeZone('Asia/Ho_Chi_Minh');
  createConfigSheet_(spreadsheet);
  createMachinesSheet_(spreadsheet);
  createLedgerSheet_(spreadsheet);
  createSheetWithHeader_(spreadsheet, SHEET_NAMES.snapshots, SNAPSHOT_HEADERS);
  formatSnapshotSheet_(spreadsheet);
  var defaultSheet = spreadsheet.getSheetByName('Sheet1') || spreadsheet.getSheetByName('Trang tính1');
  if (defaultSheet && spreadsheet.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    spreadsheet.deleteSheet(defaultSheet);
  }
}

function createSheetWithHeader_(spreadsheet, name, headers) {
  if (spreadsheet.getSheetByName(name)) return null;
  var sheet = spreadsheet.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e6eef6');
  sheet.setFrozenRows(1);
  return sheet;
}

function createConfigSheet_(spreadsheet) {
  var sheet = createSheetWithHeader_(spreadsheet, SHEET_NAMES.config, ['key', 'value', 'ghi chú']);
  if (!sheet) return;
  var rows = Object.keys(CONFIG_DEFAULTS).map(function (key) {
    return [key, CONFIG_DEFAULTS[key], CONFIG_NOTES[key] || ''];
  });
  sheet.getRange(2, 2, rows.length, 1).setNumberFormat('@STRING@');
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(3, 520);
}

function setColumnFormat_(sheet, headers, fields, format) {
  var rows = sheet.getMaxRows() - 1;
  fields.forEach(function (field) {
    sheet.getRange(2, headers.indexOf(field) + 1, rows, 1).setNumberFormat(format);
  });
}

function createMachinesSheet_(spreadsheet) {
  var sheet = createSheetWithHeader_(spreadsheet, SHEET_NAMES.machines, MACHINE_HEADERS);
  if (!sheet) return;
  setColumnFormat_(sheet, MACHINE_HEADERS, MACHINE_MONEY_FIELDS, '#,##0');
  setColumnFormat_(sheet, MACHINE_HEADERS, ['ngay_mua', 'ngay_ban', 'han_tra', 'ngay_tien_ve'], 'dd/MM/yyyy');
  setColumnFormat_(sheet, MACHINE_HEADERS, ['cap_nhat_luc'], 'dd/MM/yyyy HH:mm');
  // Plain text, so "1/2" or "86%" in a model or condition never turns into a date / number.
  setColumnFormat_(sheet, MACHINE_HEADERS, ['ma_may', 'nhom', 'model', 'imei5', 'tinh_trang', 'trang_thai', 'kenh_ban',
    'doi_tac', 'ma_van_don', 'ghi_chu'], '@');
  var statuses = [STATUS.stock, STATUS.shipping, STATUS.credit, STATUS.done];
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(statuses, true).setAllowInvalid(false).build();
  sheet.getRange(2, MACHINE_HEADERS.indexOf('trang_thai') + 1, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  sheet.getRange(1, 1).setNote('Mã máy tự sinh. Ghi mã lên máy (giấy dán) để chọn đúng khi bán.');
  sheet.getRange(1, MACHINE_HEADERS.indexOf('chi_phi_them') + 1).setNote('Sửa, linh kiện, phí hoàn hàng: cộng vào giá vốn.');
  sheet.setFrozenColumns(3);
}

function createLedgerSheet_(spreadsheet) {
  var sheet = createSheetWithHeader_(spreadsheet, SHEET_NAMES.ledger, LEDGER_HEADERS);
  if (!sheet) return;
  setColumnFormat_(sheet, LEDGER_HEADERS, ['thoi_gian'], 'dd/MM/yyyy HH:mm');
  setColumnFormat_(sheet, LEDGER_HEADERS, ['ngay'], 'dd/MM/yyyy');
  setColumnFormat_(sheet, LEDGER_HEADERS, ['loai', 'ma_may', 'doi_tac', 'ghi_chu'], '@');
  setColumnFormat_(sheet, LEDGER_HEADERS, ['so_tien'], '#,##0;[Red]-#,##0');
  sheet.getRange(1, LEDGER_HEADERS.indexOf('so_tien') + 1).setNote('Dương = tiền vào, âm = tiền ra. Tổng cột = tiền đang có theo sổ.');
}

function formatSnapshotSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(SHEET_NAMES.snapshots);
  setColumnFormat_(sheet, SNAPSHOT_HEADERS, ['ngay'], 'dd/MM/yyyy');
  setColumnFormat_(sheet, SNAPSHOT_HEADERS, SNAPSHOT_HEADERS.slice(1), '#,##0');
}
