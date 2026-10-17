/**
 * Every owner action (buy, sell, money in...) is planned by a pure function that returns
 * { newMachines, updates, ledgerRows } without touching the Sheet, so the logic is testable in Node.
 * ctx = { machines, ledger, config, today, now, newCode }.
 */
var ACTION_PLANNERS = {
  dau_ky: function (data, ctx) { return planOpeningBalance(data, ctx); },
  mua: function (data, ctx) { return planBuy(data, ctx); },
  chi_sua: function (data, ctx) { return planExtraCost(data, ctx); },
  ban: function (data, ctx) { return planSell(data, ctx); },
  doi_may: function (data, ctx) { return planTradeIn(data, ctx); },
  tien_ve: function (data, ctx) { return planMoneyIn(data, ctx); },
  hoan: function (data, ctx) { return planReturn(data, ctx); },
  ha_gia: function (data, ctx) { return planReprice(data, ctx); },
  bao_hanh: function (data, ctx) { return planWarranty(data, ctx); },
  thu_chi: function (data, ctx) { return planOtherFlow(data, ctx); },
  doi_chieu: function (data, ctx) { return planReconcile(data, ctx); }
};

/** Actions that create a machine need a fresh code allocated before planning. */
var ACTIONS_CREATING_MACHINE = ['mua', 'doi_may'];

function planAction(action, data, ctx) {
  if (!Object.prototype.hasOwnProperty.call(ACTION_PLANNERS, action)) return { ok: false, error: 'Thao tác không hợp lệ.' };
  // Anything entered before the opening count would be subtracted twice once the count is typed in.
  var hasOpening = ctx.ledger.some(function (row) { return row.loai === LEDGER.opening; });
  if (action !== 'dau_ky' && !hasOpening) return { ok: false, error: 'Nhập "Kiểm kê đầu kỳ" trước, rồi mới nhập các thao tác khác.' };
  try {
    var result = ACTION_PLANNERS[action](data || {}, ctx);
    return { ok: true, message: result.message, plan: result.plan };
  } catch (err) {
    if (err && err.userError) return { ok: false, error: err.userError };
    throw err;
  }
}

function fail(message) {
  throw { userError: message };
}

function emptyPlan() {
  return { newMachines: [], updates: [], ledgerRows: [] };
}

var MAX_PRICE = 500000000;
var MAX_FEE = 30000000;

/** Positive whole-đồng amount; optional ones default to 0. max catches a slipped "tr" vs "k". */
function readMoney(value, label, required, max) {
  if (value === '' || value == null) {
    if (required) fail('Thiếu ' + label + '.');
    return 0;
  }
  var number = Number(value);
  if (isNaN(number) || number < 0) fail(label + ' không hợp lệ.');
  if (required && number === 0) fail(label + ' phải lớn hơn 0.');
  if (number > (max || MAX_PRICE)) fail(label + ' ' + formatShortVnd(number) + ' quá lớn, kiểm tra lại "tr" hay "k".');
  return Math.round(number);
}

/** Money cannot move before the machine was bought / sold. */
function requireNotBefore(date, earlier, what) {
  if (isValidDate(earlier) && daysBetween(earlier, date) < 0) fail('Ngày không được trước ' + what + ' (' + formatDayMonth(earlier) + ').');
}

/** Event day: defaults to today; back-dating is allowed (catch-up entry), the future is not. */
function readEventDate(value, ctx) {
  if (!value) return ctx.today;
  var date = parseIsoDate(value);
  if (!date) fail('Ngày không hợp lệ.');
  if (daysBetween(ctx.today, date) > 0) fail('Ngày không được ở tương lai.');
  if (daysBetween(date, ctx.today) > 730) fail('Ngày quá xa, kiểm tra lại năm.');
  return date;
}

function readChoice(value, options, label) {
  var text = cleanText(value, 40);
  if (options.indexOf(text) === -1) fail('Chọn ' + label + '.');
  return text;
}

function findMachine(ctx, code, allowedStatuses) {
  var wanted = cleanText(code, 20).toUpperCase();
  var machine = ctx.machines.filter(function (item) { return item.ma_may === wanted; })[0];
  if (!machine) fail('Không tìm thấy máy ' + (wanted || '(chưa chọn)') + '.');
  if (allowedStatuses && allowedStatuses.indexOf(machine.trang_thai) === -1) {
    fail('Máy ' + wanted + ' đang ở trạng thái "' + machine.trang_thai + '", không làm thao tác này được.');
  }
  return machine;
}

function ledgerRow(ctx, date, type, amount, machineCode, partner, note) {
  return {
    thoi_gian: ctx.now, ngay: date, loai: type, so_tien: Math.round(amount),
    ma_may: machineCode || '', doi_tac: partner || '', ghi_chu: cleanText(note, 200)
  };
}

function machineLabel(machine) {
  return machine.ma_may + ' ' + machine.model;
}
