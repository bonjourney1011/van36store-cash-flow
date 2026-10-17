/**
 * Pure: shapes everything the page needs into one JSON-safe object.
 * Dates leave as "yyyy-mm-dd" strings, because JSON.stringify(Date) would shift them to UTC.
 */
var TREND_POINTS = 120;
var RECENT_LEDGER_ROWS = 15;
var SOLD_PICKER_DAYS = 60;

function distinctRecent(values, limit) {
  var seen = {};
  var result = [];
  for (var i = values.length - 1; i >= 0 && result.length < limit; i--) {
    var value = cleanText(values[i], 60);
    if (value && !seen[value]) { seen[value] = true; result.push(value); }
  }
  return result;
}

function buildDashboardPayload(state, today) {
  var config = state.config;
  var dash = computeDashboard(state.machines, state.ledger, state.snapshots, config, today);
  var trend = state.snapshots.slice(-TREND_POINTS).map(function (s) {
    return { ngay: formatIsoDate(s.ngay), tien: toNumberOrZero(s.tien), cho_thu: toNumberOrZero(s.cho_thu), may_ton: toNumberOrZero(s.may_ton) };
  }).filter(function (point) { return point.ngay !== dash.today; });
  trend.push({ ngay: dash.today, tien: dash.buckets.cash, cho_thu: dash.buckets.receivable, may_ton: dash.buckets.stock });

  return {
    ok: true,
    dashboard: dash,
    recommendations: buildRecommendations(dash, config),
    sold: state.machines.filter(function (m) {
      return m.trang_thai === STATUS.done && isValidDate(m.ngay_tien_ve) && daysBetween(m.ngay_tien_ve, today) <= SOLD_PICKER_DAYS;
    }).map(function (m) {
      return { ma_may: m.ma_may, model: m.model, gia_ban: toNumberOrZero(m.gia_ban), profit: machineProfit(m), ngay_tien_ve: formatIsoDate(m.ngay_tien_ve) };
    }).reverse(),
    lists: {
      groups: splitList(config.nhom_may),
      carriers: splitList(config.hang_van_chuyen),
      dealers: distinctRecent(state.machines.filter(function (m) { return m.kenh_ban === CHANNEL.dealer; })
        .map(function (m) { return m.doi_tac; }), 20),
      models: distinctRecent(state.machines.map(function (m) { return m.model; }), 40),
      otherFlowTypes: Object.keys(OTHER_FLOW_SIGNS)
    },
    trend: trend,
    recentLedger: state.ledger.slice(-RECENT_LEDGER_ROWS).reverse().map(function (row) {
      return { ngay: formatIsoDate(row.ngay), loai: row.loai, so_tien: toNumberOrZero(row.so_tien), ma_may: row.ma_may, ghi_chu: row.ghi_chu };
    }),
    settings: {
      cod_canh_bao_ngay: config.cod_canh_bao_ngay,
      han_no_moi_mac_dinh: config.han_no_moi_mac_dinh,
      von_dem_pct: config.von_dem_pct,
      tran_1_may_pct: config.tran_1_may_pct
    }
  };
}
