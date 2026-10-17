/**
 * Pure planners for money going OUT into machines and machines going OUT to buyers:
 * opening balance, buy, extra cost (repair / parts), sell (store / dealer / COD), trade-in.
 */
function planOpeningBalance(data, ctx) {
  var already = ctx.ledger.some(function (row) { return row.loai === LEDGER.opening; });
  if (already) fail('Đã có số dư đầu kỳ. Muốn sửa số tiền thì dùng "Đối chiếu số dư".');
  var cash = readMoney(data.tien_mat, 'tiền mặt', false);
  var bank = readMoney(data.so_du_tk, 'số dư tài khoản', false);
  var loan = readMoney(data.no_vay, 'nợ vay đang có', false);
  var date = readEventDate(data.ngay, ctx);
  var plan = emptyPlan();
  // An existing loan: a "Vay" row records the debt, the opening row is reduced by the same amount,
  // so cash still sums to what was counted.
  plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.opening, cash + bank - loan, '', '',
    'Tiền mặt ' + formatVnd(cash) + ' + TK ' + formatVnd(bank) + (loan ? ' (tách nợ vay ' + formatVnd(loan) + ')' : '')));
  if (loan) plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.loanIn, loan, '', '', 'Nợ vay có từ trước'));
  return { plan: plan, message: 'Đã ghi tiền đầu kỳ ' + formatShortVnd(cash + bank) + (loan ? ', nợ vay ' + formatShortVnd(loan) : '') + '. Giờ thêm các máy đang có bằng "Mua máy" → "Máy có sẵn".' };
}

function readNewMachine(data, ctx, priceField, priceLabel) {
  var groups = splitList(ctx.config.nhom_may);
  var model = cleanText(data.model, 60);
  if (!model) fail('Thiếu tên máy (model).');
  var expected = readMoney(data.gia_ky_vong, 'giá kỳ vọng', false);
  var floor = readMoney(data.gia_san, 'giá sàn', false);
  if (expected && floor && floor > expected) fail('Giá sàn không được cao hơn giá kỳ vọng.');
  return {
    ma_may: ctx.newCode,
    nhom: readChoice(data.nhom, groups, 'nhóm máy'),
    model: model,
    imei5: cleanText(data.imei5, 8).replace(/[^\w]/g, ''),
    tinh_trang: cleanText(data.tinh_trang, 120),
    gia_mua: readMoney(data[priceField], priceLabel, true),
    chi_phi_them: 0,
    gia_ky_vong: expected,
    gia_san: floor,
    trang_thai: STATUS.stock,
    so_lan_ha_gia: 0,
    ghi_chu: cleanText(data.ghi_chu, 200)
  };
}

function planBuy(data, ctx) {
  var machine = readNewMachine(data, ctx, 'gia_mua', 'giá mua');
  var date = readEventDate(data.ngay, ctx);
  machine.ngay_mua = date;
  var plan = emptyPlan();
  plan.newMachines.push(machine);
  // "Máy có sẵn" = stock counted at the opening, already paid before tracking started.
  if (data.co_san !== true) {
    plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.buy, -machine.gia_mua, machine.ma_may, '', machine.model));
  }
  return { plan: plan, message: 'Đã thêm ' + machineLabel(machine) + ' · vốn ' + formatShortVnd(machine.gia_mua) + '. Ghi mã ' + machine.ma_may + ' lên máy nhé.' };
}

function planExtraCost(data, ctx) {
  var machine = findMachine(ctx, data.ma_may, [STATUS.stock, STATUS.shipping, STATUS.credit]);
  var amount = readMoney(data.so_tien, 'số tiền', true, MAX_FEE);
  var date = readEventDate(data.ngay, ctx);
  var plan = emptyPlan();
  plan.updates.push({ ma_may: machine.ma_may, changes: { chi_phi_them: toNumberOrZero(machine.chi_phi_them) + amount } });
  plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.extraCost, -amount, machine.ma_may, '', data.ghi_chu));
  return { plan: plan, message: 'Đã cộng ' + formatShortVnd(amount) + ' vào vốn ' + machineLabel(machine) + ' (vốn mới ' + formatShortVnd(machineCost(machine) + amount) + ').' };
}

function profitHint(machine, price) {
  var profit = price - machineCost(machine);
  return profit >= 0 ? ' Lãi dự kiến ' + formatShortVnd(profit) + '.' : ' Lỗ dự kiến ' + formatShortVnd(-profit) + '.';
}

function planSell(data, ctx) {
  var machine = findMachine(ctx, data.ma_may, [STATUS.stock]);
  var channel = readChoice(data.kenh_ban, [CHANNEL.store, CHANNEL.dealer, CHANNEL.cod], 'kênh bán');
  var price = readMoney(data.gia_ban, 'giá bán', true);
  var date = readEventDate(data.ngay, ctx);
  requireNotBefore(date, machine.ngay_mua, 'ngày mua máy');
  var plan = emptyPlan();
  var changes = { kenh_ban: channel, ngay_ban: date, gia_ban: price };
  var message;

  if (channel === CHANNEL.store) {
    changes.trang_thai = STATUS.done;
    changes.da_thu = price;
    changes.ngay_tien_ve = date;
    plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.saleIn, price, machine.ma_may, '', 'Bán tại chỗ'));
    message = 'Đã bán ' + machineLabel(machine) + ', tiền về ' + formatShortVnd(price) + '.';
  } else if (channel === CHANNEL.dealer) {
    var dealer = cleanText(data.doi_tac, 40);
    if (!dealer) fail('Thiếu tên mối.');
    var paidNow = data.tra_ngay === true ? price : readMoney(data.da_tra, 'số mối trả trước', false);
    if (paidNow > price) fail('Số mối trả không được lớn hơn giá bán.');
    changes.doi_tac = dealer;
    changes.da_thu = paidNow;
    if (paidNow === price) {
      changes.trang_thai = STATUS.done;
      changes.ngay_tien_ve = date;
    } else {
      changes.trang_thai = STATUS.credit;
      changes.han_tra = data.han_tra ? readDueDate(data.han_tra, date) : addDays(date, ctx.config.han_no_moi_mac_dinh);
    }
    if (paidNow > 0) plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.saleIn, paidNow, machine.ma_may, dealer, 'Mối trả'));
    message = paidNow === price
      ? 'Đã bán cho ' + dealer + ', tiền về đủ ' + formatShortVnd(price) + '.'
      : 'Đã ghi ' + dealer + ' nợ ' + formatShortVnd(price - paidNow) + ', hạn ' + formatDayMonth(changes.han_tra) + '.';
  } else {
    var carrier = readChoice(data.doi_tac, splitList(ctx.config.hang_van_chuyen), 'hãng vận chuyển (có trong Config → hang_van_chuyen)');
    var deposit = readMoney(data.tien_coc, 'tiền cọc', false);
    if (deposit >= price) fail('Cọc bằng hoặc hơn giá bán thì chọn "Tại chỗ" (đã thu đủ).');
    changes.trang_thai = STATUS.shipping;
    changes.doi_tac = carrier;
    changes.ma_van_don = cleanText(data.ma_van_don, 40);
    changes.tien_coc = deposit;
    changes.da_thu = deposit;
    if (deposit > 0) plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.deposit, deposit, machine.ma_may, carrier, 'Cọc COD'));
    message = 'Đã gửi ' + machineLabel(machine) + ' qua ' + carrier + ', chờ thu ' + formatShortVnd(price - deposit) + '.';
  }

  plan.updates.push({ ma_may: machine.ma_may, changes: changes });
  return { plan: plan, message: message + profitHint(machine, price) };
}

function readDueDate(value, saleDate) {
  var date = parseIsoDate(value);
  if (!date || daysBetween(saleDate, date) < 0) fail('Hạn trả phải từ ngày bán trở đi.');
  return date;
}

/** Customer hands in an old machine as part payment: one sale + one purchase, cash = difference. */
function planTradeIn(data, ctx) {
  var sold = findMachine(ctx, data.ma_may, [STATUS.stock]);
  var price = readMoney(data.gia_ban, 'giá bán máy đưa khách', true);
  var received = readNewMachine(data, ctx, 'gia_nhan', 'giá định máy nhận về');
  var date = readEventDate(data.ngay, ctx);
  requireNotBefore(date, sold.ngay_mua, 'ngày mua máy đưa khách');
  received.ngay_mua = date;
  received.ghi_chu = cleanText('Đổi từ ' + sold.ma_may + '. ' + received.ghi_chu, 200);
  var plan = emptyPlan();
  plan.updates.push({ ma_may: sold.ma_may, changes: {
    trang_thai: STATUS.done, kenh_ban: CHANNEL.store, ngay_ban: date, gia_ban: price, da_thu: price, ngay_tien_ve: date
  } });
  plan.newMachines.push(received);
  plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.saleIn, price, sold.ma_may, '', 'Đổi máy, nhận ' + received.ma_may));
  plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.buy, -received.gia_mua, received.ma_may, '', 'Nhận đổi từ ' + sold.ma_may));
  var diff = price - received.gia_mua;
  var cashText = diff >= 0 ? 'khách bù ' + formatShortVnd(diff) : 'mình bù ' + formatShortVnd(-diff);
  return { plan: plan, message: 'Đã đổi ' + sold.ma_may + ' lấy ' + received.ma_may + ' (' + cashText + ').' + profitHint(sold, price) };
}
