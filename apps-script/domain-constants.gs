/**
 * Shared vocabulary: tab names, column headers, machine statuses, ledger types and Config defaults.
 * Machine and ledger objects use the header names as keys, so Sheet columns and logic never drift.
 * Columns are written by position: add new headers only at the END of a list.
 */
var SHEET_NAMES = { config: 'Config', machines: 'May', ledger: 'SoTien', snapshots: 'Snapshot' };

var MACHINE_HEADERS = [
  'ma_may', 'nhom', 'model', 'imei5', 'tinh_trang', 'ngay_mua', 'gia_mua', 'chi_phi_them',
  'gia_ky_vong', 'gia_san', 'trang_thai', 'kenh_ban', 'doi_tac', 'ma_van_don', 'ngay_ban',
  'gia_ban', 'tien_coc', 'da_thu', 'phi_ship', 'han_tra', 'ngay_tien_ve', 'chi_phi_bao_hanh',
  'so_lan_ha_gia', 'ghi_chu', 'cap_nhat_luc'
];
var LEDGER_HEADERS = ['thoi_gian', 'ngay', 'loai', 'so_tien', 'ma_may', 'doi_tac', 'ghi_chu'];
var SNAPSHOT_HEADERS = ['ngay', 'tien', 'cho_thu', 'may_ton', 'no', 'von_chu'];

var MACHINE_DATE_FIELDS = ['ngay_mua', 'ngay_ban', 'han_tra', 'ngay_tien_ve', 'cap_nhat_luc'];
var MACHINE_MONEY_FIELDS = ['gia_mua', 'chi_phi_them', 'gia_ky_vong', 'gia_san', 'gia_ban', 'tien_coc',
  'da_thu', 'phi_ship', 'chi_phi_bao_hanh', 'so_lan_ha_gia'];
// Cleared when a COD parcel comes back, so the machine can be sold again from scratch.
var SALE_FIELDS = ['kenh_ban', 'doi_tac', 'ma_van_don', 'ngay_ban', 'gia_ban', 'tien_coc', 'da_thu',
  'phi_ship', 'han_tra', 'ngay_tien_ve'];

var STATUS = { stock: 'Tồn', shipping: 'Đang gửi', credit: 'Nợ mối', done: 'Đã thu' };
var CHANNEL = { cod: 'COD', store: 'Tại chỗ', dealer: 'Mối' };

var LEDGER = {
  opening: 'Đầu kỳ', buy: 'Mua máy', extraCost: 'Chi sửa', saleIn: 'Thu bán', deposit: 'Thu cọc',
  shipFee: 'Phí ship', warranty: 'Bảo hành', fixedCost: 'Chi cố định', withdraw: 'Rút cá nhân',
  capitalIn: 'Góp vốn', loanIn: 'Vay', loanRepay: 'Trả vay', otherIn: 'Thu khác', adjust: 'Điều chỉnh'
};
// Owner always types a positive amount for "Thu/chi khác"; the sign comes from the type.
var OTHER_FLOW_SIGNS = {
  'Chi cố định': -1, 'Rút cá nhân': -1, 'Góp vốn': 1, 'Vay': 1, 'Trả vay': -1, 'Thu khác': 1
};

var CONFIG_DEFAULTS = {
  nhom_may: 'iPhone, Laptop, Khác',
  von_dem_pct: 0.15,
  tran_1_may_pct: 0.3,
  may_lon_pct: 0.2,
  ngay_giu_toi_da_may_lon: 14,
  canh_bao_ton_ngay_iphone: 10,
  canh_bao_ton_ngay_laptop: 20,
  canh_bao_ton_ngay_mac_dinh: 15,
  cod_canh_bao_ngay: 7,
  han_no_moi_mac_dinh: 3,
  buoc_ha_gia_pct: 0.03,
  r_mac_dinh: 0.003,
  mat_gia_thang_pct: 0.03,
  ton_kho_toi_da_pct: 0.75,
  doi_chieu_moi_ngay: 7,
  hang_van_chuyen: 'GHTK, Viettel Post, J&T, GHN',
  site_url: ''
};

/** Config tab values over defaults; numbers stay numbers even if typed as text. */
function resolveConfig(raw) {
  var config = {};
  Object.keys(CONFIG_DEFAULTS).forEach(function (key) {
    var fallback = CONFIG_DEFAULTS[key];
    var value = raw && raw[key] !== undefined && raw[key] !== '' ? raw[key] : fallback;
    // "0,15" typed the Vietnamese way reads as 0.15, and "15%" as 0.15 too.
    var text = String(value).trim().replace(',', '.');
    var number = /%$/.test(text) ? Number(text.slice(0, -1)) / 100 : Number(text);
    config[key] = typeof fallback === 'number' ? (isNaN(number) ? fallback : number) : String(value);
  });
  Object.keys(raw || {}).forEach(function (key) {
    if (config[key] === undefined) config[key] = raw[key];
  });
  return config;
}

function splitList(text) {
  return String(text || '').split(',').map(function (item) { return cleanText(item, 40); }).filter(Boolean);
}

/** Aging limit for a group, e.g. Config canh_bao_ton_ngay_iphone; falls back to the default key. */
function ageLimitForGroup(config, group) {
  var value = Number(config['canh_bao_ton_ngay_' + slugify(group)]);
  return value > 0 ? value : config.canh_bao_ton_ngay_mac_dinh;
}

function machineCost(machine) {
  return toNumberOrZero(machine.gia_mua) + toNumberOrZero(machine.chi_phi_them);
}

/** Money still to come in for a shipped / credit sale. */
function machineOutstanding(machine) {
  return Math.max(0, toNumberOrZero(machine.gia_ban) - toNumberOrZero(machine.da_thu) - toNumberOrZero(machine.phi_ship));
}

/** Realised profit of a finished sale (all money in, every cost attached to the machine). */
function machineProfit(machine) {
  return toNumberOrZero(machine.gia_ban) - machineCost(machine) - toNumberOrZero(machine.phi_ship) -
    toNumberOrZero(machine.chi_phi_bao_hanh);
}
