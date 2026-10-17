/**
 * Pure FP&A maths behind the dashboard (no Google services, tested in Node).
 * Buckets: A cash, B money on its way (COD + dealer credit), C stock at COST, D loans.
 * Profit only counts once the money is in; stock is never valued at the hoped-for price.
 */
var LOOKBACK_DAYS = 90;
var MIN_SAMPLE_FOR_R = 5;
var MIN_SAMPLE_FOR_GROUP_R = 3;

function computeBuckets(machines, ledger) {
  var cash = 0;
  var debt = 0;
  ledger.forEach(function (row) {
    var amount = toNumberOrZero(row.so_tien);
    cash += amount;
    if (row.loai === LEDGER.loanIn || row.loai === LEDGER.loanRepay) debt += amount;
  });
  var receivable = 0;
  var stock = 0;
  machines.forEach(function (m) {
    if (m.trang_thai === STATUS.stock) stock += machineCost(m);
    else if (m.trang_thai === STATUS.shipping || m.trang_thai === STATUS.credit) receivable += machineOutstanding(m);
  });
  debt = Math.max(0, debt);
  return { cash: cash, receivable: receivable, stock: stock, debt: debt, equity: cash + receivable + stock - debt };
}

function soldWithin(machines, today, days) {
  return machines.filter(function (m) {
    return m.trang_thai === STATUS.done && isValidDate(m.ngay_tien_ve) && isValidDate(m.ngay_mua) &&
      daysBetween(m.ngay_tien_ve, today) <= days;
  });
}

/**
 * r = profit earned per đồng of capital per day, from recent finished sales:
 * sum(profit) / sum(cost × days the money was tied up). This is the opportunity cost of holding.
 */
function capitalReturnPerDay(finished) {
  var profit = 0;
  var capitalDays = 0;
  finished.forEach(function (m) {
    profit += machineProfit(m);
    capitalDays += machineCost(m) * Math.max(1, daysBetween(m.ngay_mua, m.ngay_tien_ve));
  });
  return capitalDays > 0 ? profit / capitalDays : null;
}

function average(values) {
  return values.length ? values.reduce(function (s, v) { return s + v; }, 0) / values.length : null;
}

function computeKpis(machines, ledger, buckets, config, today) {
  var finished = soldWithin(machines, today, LOOKBACK_DAYS);
  var measuredR = finished.length >= MIN_SAMPLE_FOR_R ? capitalReturnPerDay(finished) : null;
  var r = measuredR != null && measuredR > 0 ? measuredR : config.r_mac_dinh;
  var dio = average(finished.map(function (m) { return Math.max(0, daysBetween(m.ngay_mua, m.ngay_ban || m.ngay_tien_ve)); }));
  var dso = average(finished.map(function (m) { return Math.max(0, daysBetween(m.ngay_ban || m.ngay_tien_ve, m.ngay_tien_ve)); }));
  var ccc = dio == null ? null : dio + dso;

  var firstDay = ledger.reduce(function (min, row) { return isValidDate(row.ngay) && (!min || row.ngay < min) ? row.ngay : min; }, null);
  // A young ledger has fewer than 90 days of sales: average over the days actually tracked.
  var windowDays = Math.max(1, Math.min(LOOKBACK_DAYS, firstDay ? daysBetween(firstDay, today) + 1 : LOOKBACK_DAYS));
  var cogs = finished.reduce(function (sum, m) { return sum + machineCost(m); }, 0);
  var cogsPerDay = cogs / windowDays;
  var profit30 = soldWithin(machines, today, 30).reduce(function (sum, m) { return sum + machineProfit(m); }, 0);

  var equity = Math.max(0, buckets.equity);
  var buffer = config.von_dem_pct * equity;
  var wcNeeded = ccc == null ? null : cogsPerDay * ccc + buffer;
  var totalAssets = buckets.cash + buckets.receivable + buckets.stock;
  return {
    sampleSize: finished.length,
    r: r,
    rSource: measuredR != null && measuredR > 0 ? 'thuc_te' : 'mac_dinh',
    dio: dio, dso: dso, ccc: ccc,
    cogsPerDay: cogsPerDay,
    turnover30: equity > 0 ? cogsPerDay * 30 / equity : null,
    profit30: profit30,
    buffer: buffer,
    wcNeeded: wcNeeded,
    wcGap: wcNeeded == null ? null : equity - wcNeeded,
    maxBuyToday: Math.max(0, Math.min(buckets.cash - buffer, config.tran_1_may_pct * equity)),
    cashShare: totalAssets > 0 ? buckets.cash / totalAssets : 0,
    stockShare: equity > 0 ? buckets.stock / equity : 0,
    groups: groupStats(finished, splitList(config.nhom_may))
  };
}

function groupStats(finished, groups) {
  return groups.map(function (group) {
    var items = finished.filter(function (m) { return m.nhom === group; });
    return {
      nhom: group,
      count: items.length,
      r: items.length >= MIN_SAMPLE_FOR_GROUP_R ? capitalReturnPerDay(items) : null,
      dio: average(items.map(function (m) { return Math.max(0, daysBetween(m.ngay_mua, m.ngay_ban || m.ngay_tien_ve)); })),
      profit: items.reduce(function (sum, m) { return sum + machineProfit(m); }, 0)
    };
  });
}

function bucketByAge(items, edges, labels) {
  var buckets = labels.map(function (label) { return { label: label, amount: 0, count: 0 }; });
  items.forEach(function (item) {
    var index = edges.length;
    for (var i = 0; i < edges.length; i++) { if (item.days <= edges[i]) { index = i; break; } }
    buckets[index].amount += item.amount;
    buckets[index].count += 1;
  });
  return buckets;
}

/** Everything the page and the daily email need, from raw machines + ledger rows. */
function computeDashboard(machines, ledger, snapshots, config, today) {
  var buckets = computeBuckets(machines, ledger);
  var kpis = computeKpis(machines, ledger, buckets, config, today);
  var stockList = buildStockList(machines, buckets, kpis, config, today);
  var pendingList = buildPendingList(machines, config, today);
  return {
    today: formatIsoDate(today),
    hasOpening: ledger.some(function (row) { return row.loai === LEDGER.opening; }),
    buckets: buckets,
    kpis: kpis,
    stockList: stockList,
    pendingList: pendingList,
    stockAging: bucketByAge(stockList.map(function (s) { return { days: s.days, amount: s.cost }; }), [7, 14, 30], ['0–7 ngày', '8–14 ngày', '15–30 ngày', '>30 ngày']),
    pendingAging: bucketByAge(pendingList.map(function (p) { return { days: p.days, amount: p.outstanding }; }), [3, 7], ['0–3 ngày', '4–7 ngày', '>7 ngày']),
    hopedProfit: stockList.reduce(function (sum, s) { return sum + Math.max(0, s.gia_ky_vong - s.cost); }, 0),
    monthBridge: buildMonthBridge(machines, ledger, snapshots, buckets, today),
    daysSinceReconcile: daysSinceLast(ledger, [LEDGER.adjust, LEDGER.opening], today)
  };
}

function daysSinceLast(ledger, types, today) {
  var last = null;
  ledger.forEach(function (row) {
    if (types.indexOf(row.loai) !== -1 && isValidDate(row.ngay) && (!last || row.ngay > last)) last = row.ngay;
  });
  return last ? daysBetween(last, today) : null;
}
