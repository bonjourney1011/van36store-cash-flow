/**
 * Pure rules turning the dashboard numbers into at most 5 plain-language actions.
 * level: 'do' = act today, 'vang' = watch this week, 'xanh' = all good.
 */
var MAX_RECOMMENDATIONS = 5;
var LEVEL_ORDER = { do: 0, vang: 1, xanh: 2 };

function bestGroup(kpis) {
  return kpis.groups.filter(function (g) { return g.r != null; })
    .sort(function (a, b) { return b.r - a.r; })[0] || null;
}

function priceAdvice(item) {
  if (item.suggestedPrice) return 'hạ về ' + formatShortVnd(item.suggestedPrice);
  if (item.gia_san) return 'bán ở giá sàn ' + formatShortVnd(item.gia_san);
  return 'đặt giá sàn và chào mối';
}

function buildRecommendations(dash, config) {
  var recs = [];
  var add = function (level, title, detail) { recs.push({ level: level, title: title, detail: detail }); };
  var k = dash.kpis;
  var b = dash.buckets;

  if (!dash.hasOpening) {
    add('do', 'Bắt đầu bằng kiểm kê đầu kỳ', 'Đếm tiền mặt + số dư tài khoản → nhập "Đầu kỳ". Sau đó thêm từng máy đang có bằng "Mua máy" → "Máy có sẵn".');
  }
  if (dash.hasOpening && b.cash < k.buffer) {
    var top = dash.stockList[0];
    add('do', 'Tiền dưới mức đệm: tạm dừng mua máy',
      'Tiền ' + formatShortVnd(b.cash) + ', mức đệm ' + formatShortVnd(k.buffer) + '.' +
      (top ? ' Ưu tiên xả ' + top.model + ' (' + top.ma_may + ', ' + top.days + ' ngày).' : ''));
  }

  dash.stockList.filter(function (s) { return s.bigOverHold; }).slice(0, 2).forEach(function (s) {
    add('do', 'Xả ' + s.model + ' (' + s.ma_may + '): chiếm ' + formatPercent(s.share) + ' vốn, ' + s.days + ' ngày',
      'Chi phí giữ đã ~' + formatShortVnd(s.holdingCost) + '. Giữ thêm 7 ngày phải bán cao hơn ~' +
      formatShortVnd(s.extraPer7) + ' mới hoà. Gợi ý: ' + priceAdvice(s) + ' hoặc đẩy mối.');
  });

  var lateCod = dash.pendingList.filter(function (p) { return p.trang_thai === STATUS.shipping && p.overdue; });
  if (lateCod.length) {
    var first = lateCod[0];
    add('vang', lateCod.length + ' đơn COD quá ' + config.cod_canh_bao_ngay + ' ngày chưa có tiền (' + formatShortVnd(sumOf(lateCod, 'outstanding')) + ')',
      'Lâu nhất: ' + first.model + ' qua ' + first.doi_tac + (first.ma_van_don ? ' (' + first.ma_van_don + ')' : '') + ', ' + first.days +
      ' ngày. Hỏi hãng trạng thái; nếu tiền đã về thì bấm "Tiền về".');
  }
  var lateDealers = groupBy(dash.pendingList.filter(function (p) { return p.trang_thai === STATUS.credit && p.overdue; }), 'doi_tac');
  Object.keys(lateDealers).forEach(function (dealer) {
    var items = lateDealers[dealer];
    add('vang', 'Mối ' + dealer + ' quá hạn: còn nợ ' + formatShortVnd(sumOf(items, 'outstanding')),
      items.length + ' máy, trễ nhất ' + Math.max.apply(null, items.map(function (p) { return p.overdueDays; })) + ' ngày. Nhắc trả trước khi giao máy tiếp.');
  });

  var aging = dash.stockList.filter(function (s) { return s.overAge && !s.bigOverHold; });
  if (aging.length) {
    add('vang', aging.length + ' máy quá hạn tồn, đọng ' + formatShortVnd(sumOf(aging, 'cost')),
      aging.slice(0, 3).map(function (s) { return s.model + ' ' + s.days + ' ngày → ' + priceAdvice(s); }).join('; ') + '.');
  }
  var notWorth = dash.stockList.filter(function (s) { return s.maxWaitDays !== null && s.maxWaitDays <= 0 && !s.overAge && !s.bigOverHold; });
  if (notWorth.length) {
    var s0 = notWorth[0];
    add('vang', 'Chờ giá ' + formatShortVnd(s0.gia_ky_vong) + ' cho ' + s0.model + ' không còn đáng',
      'Mỗi ngày giữ tốn ~' + formatShortVnd(s0.dailyCarry) + ', phần chênh so với giá sàn không bù nổi nữa. Bán ở ' + formatShortVnd(s0.gia_san) + '.');
  }

  if (b.equity > 0 && k.stockShare > config.ton_kho_toi_da_pct) {
    var group = bestGroup(k);
    add('vang', 'Tiền đang đọng ' + formatPercent(k.stockShare) + ' vốn trong máy (ngưỡng ' + formatPercent(config.ton_kho_toi_da_pct) + ')',
      'Mua chậm lại, chỉ nhập máy quay nhanh' + (group ? ' (nhóm ' + group.nhom + ' đang quay vốn tốt nhất)' : '') + '.');
  }
  if (k.wcGap !== null && k.wcGap < 0) {
    add('vang', 'Vốn mỏng so với nhịp bán: thiếu ~' + formatShortVnd(-k.wcGap),
      'Nhịp hiện tại cần ~' + formatShortVnd(k.wcNeeded) + ' (giá vốn bán ' + formatShortVnd(k.cogsPerDay) + '/ngày × chu kỳ ' +
      Math.round(k.ccc) + ' ngày + đệm). Rút ngắn chu kỳ (bán nhanh, giục COD) trước khi tăng nhập.');
  }
  if (dash.hasOpening && dash.daysSinceReconcile !== null && dash.daysSinceReconcile > config.doi_chieu_moi_ngay) {
    add('vang', 'Đã ' + dash.daysSinceReconcile + ' ngày chưa đối chiếu số dư', 'Đếm tiền mặt + xem số dư TK → "Đối chiếu". Bước này giữ số tiền trên trang luôn đúng.');
  }

  if (!recs.length) {
    var best = bestGroup(k);
    add('xanh', 'Dòng tiền ổn', 'Hôm nay mua được tối đa ' + formatShortVnd(k.maxBuyToday) + '.' +
      (best ? ' Nhóm quay vốn tốt nhất: ' + best.nhom + '.' : ''));
  }
  return recs.sort(function (x, y) { return LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level]; }).slice(0, MAX_RECOMMENDATIONS);
}

function sumOf(items, field) {
  return items.reduce(function (sum, item) { return sum + (Number(item[field]) || 0); }, 0);
}

function groupBy(items, field) {
  var groups = {};
  items.forEach(function (item) { (groups[item[field]] = groups[item[field]] || []).push(item); });
  return groups;
}
