/**
 * Pure per-machine views: which stock to clear first, how long waiting for a better price
 * is still worth it, which money on its way is late, and where this month's cash went.
 */
var BRIDGE_ORDER = ['Đầu kỳ', 'Thu bán', 'Thu cọc', 'Thu khác', 'Góp vốn', 'Vay', 'Mua máy', 'Chi sửa',
  'Phí ship', 'Bảo hành', 'Chi cố định', 'Rút cá nhân', 'Trả vay', 'Điều chỉnh'];

function roundTo100k(amount) {
  return Math.round(amount / 100000) * 100000;
}

function buildStockList(machines, buckets, kpis, config, today) {
  var equity = Math.max(1, buckets.equity);
  return machines.filter(function (m) { return m.trang_thai === STATUS.stock; }).map(function (m) {
    var cost = machineCost(m);
    var days = isValidDate(m.ngay_mua) ? Math.max(0, daysBetween(m.ngay_mua, today)) : 0;
    var expected = toNumberOrZero(m.gia_ky_vong);
    var floor = toNumberOrZero(m.gia_san);
    var share = cost / equity;
    var ageLimit = ageLimitForGroup(config, m.nhom);
    var isBig = share >= config.may_lon_pct;
    // Cost of one more day: the profit this capital would earn elsewhere + the market price slipping.
    var priceRef = floor || expected || cost;
    var dailyCarry = cost * kpis.r + priceRef * config.mat_gia_thang_pct / 30;
    var overAge = days > ageLimit;
    return {
      ma_may: m.ma_may, nhom: m.nhom, model: m.model, imei5: m.imei5, tinh_trang: m.tinh_trang,
      cost: cost, gia_ky_vong: expected, gia_san: floor, so_lan_ha_gia: toNumberOrZero(m.so_lan_ha_gia),
      days: days, ageLimit: ageLimit, overAge: overAge,
      share: share, isBig: isBig, bigOverHold: isBig && days > config.ngay_giu_toi_da_may_lon,
      holdingCost: Math.round(cost * kpis.r * days),
      dailyCarry: Math.round(dailyCarry),
      extraPer7: Math.round(dailyCarry * 7),
      // Waiting for the hoped-for price only pays while the extra price covers the carry.
      maxWaitDays: expected > floor && floor > 0 && dailyCarry > 0 ? Math.floor((expected - floor) / dailyCarry) : null,
      suggestedPrice: overAge && expected ? Math.max(floor, roundTo100k(expected * (1 - config.buoc_ha_gia_pct))) : null,
      score: cost * Math.max(1, days)
    };
  }).sort(function (a, b) { return b.score - a.score; });
}

function buildPendingList(machines, config, today) {
  return machines.filter(function (m) {
    return m.trang_thai === STATUS.shipping || m.trang_thai === STATUS.credit;
  }).map(function (m) {
    var days = isValidDate(m.ngay_ban) ? Math.max(0, daysBetween(m.ngay_ban, today)) : 0;
    var isCod = m.trang_thai === STATUS.shipping;
    var due = isValidDate(m.han_tra) ? m.han_tra : null;
    var overdueDays = isCod ? days - config.cod_canh_bao_ngay : (due ? daysBetween(due, today) : 0);
    return {
      ma_may: m.ma_may, model: m.model, trang_thai: m.trang_thai, kenh_ban: m.kenh_ban,
      doi_tac: m.doi_tac, ma_van_don: m.ma_van_don, gia_ban: toNumberOrZero(m.gia_ban),
      outstanding: machineOutstanding(m), days: days,
      han_tra: due ? formatIsoDate(due) : '',
      overdue: overdueDays > 0, overdueDays: Math.max(0, overdueDays)
    };
  }).sort(function (a, b) { return b.days - a.days; });
}

function latestSnapshotOnOrBefore(snapshots, date) {
  var best = null;
  snapshots.forEach(function (s) {
    if (isValidDate(s.ngay) && daysBetween(s.ngay, date) >= 0 && (!best || s.ngay > best.ngay)) best = s;
  });
  return best;
}

/** Cash waterfall for the current month + how much more money got tied up in machines. */
function buildMonthBridge(machines, ledger, snapshots, buckets, today) {
  var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  var openingCash = 0;
  var byType = {};
  ledger.forEach(function (row) {
    if (!isValidDate(row.ngay)) return;
    var amount = toNumberOrZero(row.so_tien);
    if (row.ngay < monthStart) openingCash += amount;
    else byType[row.loai] = (byType[row.loai] || 0) + amount;
  });
  var lines = BRIDGE_ORDER.filter(function (type) { return byType[type]; })
    .map(function (type) { return { label: type, amount: byType[type] }; });
  var profitRealized = machines.filter(function (m) {
    return m.trang_thai === STATUS.done && isValidDate(m.ngay_tien_ve) && m.ngay_tien_ve >= monthStart;
  }).reduce(function (sum, m) { return sum + machineProfit(m); }, 0);
  var start = latestSnapshotOnOrBefore(snapshots, monthStart);
  return {
    monthLabel: pad(today.getMonth() + 1, 2) + '/' + today.getFullYear(),
    openingCash: openingCash,
    lines: lines,
    closingCash: buckets.cash,
    profitRealized: profitRealized,
    tiedUpNow: buckets.receivable + buckets.stock,
    tiedUpStart: start ? toNumberOrZero(start.cho_thu) + toNumberOrZero(start.may_ton) : null,
    equityStart: start ? toNumberOrZero(start.von_chu) : null,
    equityNow: buckets.equity
  };
}
