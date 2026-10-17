/**
 * Pure planners for money coming IN and corrections:
 * COD remittance / dealer payment, returned parcel, re-pricing, warranty, other flows, weekly reconcile.
 */
function readCodes(list) {
  var codes = Array.isArray(list) ? list : [];
  return codes.map(function (code) { return cleanText(code, 20).toUpperCase(); })
    .filter(function (code, index, all) { return code && all.indexOf(code) === index; });
}

function planMoneyIn(data, ctx) {
  var source = readChoice(data.nguon, [CHANNEL.cod, CHANNEL.dealer], 'nguồn tiền (COD hay mối)');
  var received = readMoney(data.tong_nhan, 'tổng tiền nhận', true);
  var date = readEventDate(data.ngay, ctx);
  return source === CHANNEL.cod ? planCodRemittance(data, ctx, received, date) : planDealerPayment(data, ctx, received, date);
}

/**
 * Carrier pays the ticked parcels in one transfer. What is missing versus the COD amounts is
 * the carrier's fee, spread over the parcels by value. A return fee the carrier deducts in the
 * same transfer is booked here as its own cash-out row (the return itself moved no cash).
 */
function planCodRemittance(data, ctx, received, date) {
  var codes = readCodes(data.ma_may_list);
  if (!codes.length) fail('Tick các đơn COD vừa được trả tiền.');
  var machines = codes.map(function (code) { return findMachine(ctx, code, [STATUS.shipping]); });
  machines.forEach(function (m) { requireNotBefore(date, m.ngay_ban, 'ngày gửi ' + m.ma_may); });
  var returnFee = readMoney(data.phi_hoan_tru, 'phí hoàn bị trừ', false, MAX_FEE);
  var expected = machines.reduce(function (sum, m) { return sum + machineOutstanding(m); }, 0);
  var fees = expected - received - returnFee;
  if (fees < 0) fail('Tiền nhận (' + formatShortVnd(received) + ') lớn hơn tổng thu hộ các đơn đã tick (' + formatShortVnd(expected) + '). Kiểm tra lại đơn hoặc số tiền.');
  var plan = emptyPlan();
  var feeLeft = fees;
  machines.forEach(function (machine, index) {
    var outstanding = machineOutstanding(machine);
    var fee = index === machines.length - 1 ? feeLeft : Math.round(fees * outstanding / (expected || 1));
    feeLeft -= fee;
    var net = outstanding - fee;
    plan.updates.push({ ma_may: machine.ma_may, changes: {
      trang_thai: STATUS.done, ngay_tien_ve: date,
      da_thu: toNumberOrZero(machine.da_thu) + net, phi_ship: toNumberOrZero(machine.phi_ship) + fee
    } });
    plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.saleIn, net, machine.ma_may, machine.doi_tac, 'COD về, phí ' + formatVnd(fee)));
  });
  if (returnFee > 0) plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.shipFee, -returnFee, '', machines[0].doi_tac, 'Phí hoàn hãng trừ khi đối soát'));
  var feeRate = expected ? fees / expected : 0;
  return { plan: plan, message: 'Đã ghi tiền về ' + machines.length + ' đơn · phí ship/COD ' + formatShortVnd(fees) + ' (' + formatPercent(feeRate) + ').' };
}

/** Dealer pays (maybe partly): oldest debts are cleared first. */
function planDealerPayment(data, ctx, received, date) {
  var dealer = cleanText(data.doi_tac, 40);
  var codes = readCodes(data.ma_may_list);
  var machines = codes.length
    ? codes.map(function (code) { return findMachine(ctx, code, [STATUS.credit]); })
    : ctx.machines.filter(function (m) { return m.trang_thai === STATUS.credit && m.doi_tac === dealer; });
  if (!machines.length) fail('Không có máy nào ' + (dealer || 'mối này') + ' đang nợ.');
  var saleTime = function (m) { return isValidDate(m.ngay_ban) ? m.ngay_ban.getTime() : 0; };
  machines.sort(function (a, b) { return saleTime(a) - saleTime(b); });
  machines.forEach(function (m) { requireNotBefore(date, m.ngay_ban, 'ngày bán ' + m.ma_may); });
  var totalDue = machines.reduce(function (sum, m) { return sum + machineOutstanding(m); }, 0);
  if (received > totalDue) fail('Mối trả (' + formatShortVnd(received) + ') nhiều hơn số đang nợ (' + formatShortVnd(totalDue) + ').');
  var plan = emptyPlan();
  var left = received;
  var cleared = 0;
  machines.forEach(function (machine) {
    if (left <= 0) return;
    var pay = Math.min(left, machineOutstanding(machine));
    left -= pay;
    var changes = { da_thu: toNumberOrZero(machine.da_thu) + pay };
    if (pay === machineOutstanding(machine)) {
      changes.trang_thai = STATUS.done;
      changes.ngay_tien_ve = date;
      cleared += 1;
    }
    plan.updates.push({ ma_may: machine.ma_may, changes: changes });
    plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.saleIn, pay, machine.ma_may, machine.doi_tac, 'Mối trả'));
  });
  var stillDue = totalDue - received;
  return { plan: plan, message: 'Đã ghi mối trả ' + formatShortVnd(received) + ', xong ' + cleared + ' máy' + (stillDue ? ', còn nợ ' + formatShortVnd(stillDue) + '.' : '.') };
}

/**
 * Parcel came back: machine returns to stock, keeps its buy date (age keeps running), the lost fee
 * raises its cost. Cash only moves if the fee was paid now; usually the carrier deducts it from a
 * later transfer, which "Tiền về" books as "phí hoàn bị trừ".
 */
function planReturn(data, ctx) {
  var machine = findMachine(ctx, data.ma_may, [STATUS.shipping, STATUS.credit]);
  // A dealer handing back an unsold machine; money already paid must be settled first.
  if (machine.trang_thai === STATUS.credit && toNumberOrZero(machine.da_thu) > 0) {
    fail('Mối đã trả ' + formatShortVnd(machine.da_thu) + ' cho máy này. Trả lại tiền cho mối (Thu/chi khác) rồi sửa da_thu trong Sheet trước.');
  }
  var fee = readMoney(data.phi_hoan, 'phí hoàn', false, MAX_FEE);
  var date = readEventDate(data.ngay, ctx);
  var deposit = toNumberOrZero(machine.tien_coc);
  var refundDeposit = data.tra_coc === true && deposit > 0;
  var plan = emptyPlan();
  var changes = { trang_thai: STATUS.stock };
  SALE_FIELDS.forEach(function (field) { changes[field] = ''; });
  // A kept deposit offsets the lost fee; a refunded one leaves the till.
  changes.chi_phi_them = toNumberOrZero(machine.chi_phi_them) + fee - (refundDeposit ? 0 : deposit);
  plan.updates.push({ ma_may: machine.ma_may, changes: changes });
  if (fee > 0 && data.tra_phi_ngay === true) {
    plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.shipFee, -fee, machine.ma_may, machine.doi_tac, 'Phí hoàn trả ngay. ' + cleanText(data.ghi_chu, 120)));
  }
  if (refundDeposit) plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.deposit, -deposit, machine.ma_may, machine.doi_tac, 'Trả lại cọc'));
  return { plan: plan, message: machineLabel(machine) + ' đã về kho. Vốn máy giờ là ' + formatShortVnd(toNumberOrZero(machine.gia_mua) + changes.chi_phi_them) + '.' };
}

function planReprice(data, ctx) {
  var machine = findMachine(ctx, data.ma_may, [STATUS.stock]);
  var expected = readMoney(data.gia_ky_vong, 'giá mới', true);
  var floor = data.gia_san === '' || data.gia_san == null ? toNumberOrZero(machine.gia_san) : readMoney(data.gia_san, 'giá sàn', false);
  if (floor > expected) floor = expected;
  var lowered = expected < toNumberOrZero(machine.gia_ky_vong);
  var plan = emptyPlan();
  plan.updates.push({ ma_may: machine.ma_may, changes: {
    gia_ky_vong: expected, gia_san: floor,
    so_lan_ha_gia: toNumberOrZero(machine.so_lan_ha_gia) + (lowered ? 1 : 0)
  } });
  return { plan: plan, message: 'Đã đổi giá ' + machineLabel(machine) + ' → ' + formatShortVnd(expected) + '.' };
}

function planWarranty(data, ctx) {
  var machine = findMachine(ctx, data.ma_may, [STATUS.done, STATUS.credit, STATUS.shipping]);
  var amount = readMoney(data.so_tien, 'chi phí bảo hành', true, MAX_FEE);
  var date = readEventDate(data.ngay, ctx);
  var plan = emptyPlan();
  plan.updates.push({ ma_may: machine.ma_may, changes: { chi_phi_bao_hanh: toNumberOrZero(machine.chi_phi_bao_hanh) + amount } });
  plan.ledgerRows.push(ledgerRow(ctx, date, LEDGER.warranty, -amount, machine.ma_may, '', data.ghi_chu));
  return { plan: plan, message: 'Đã trừ ' + formatShortVnd(amount) + ' bảo hành vào lãi ' + machineLabel(machine) + '.' };
}

function planOtherFlow(data, ctx) {
  var type = readChoice(data.loai, Object.keys(OTHER_FLOW_SIGNS), 'loại thu/chi');
  var amount = readMoney(data.so_tien, 'số tiền', true);
  var date = readEventDate(data.ngay, ctx);
  var plan = emptyPlan();
  plan.ledgerRows.push(ledgerRow(ctx, date, type, OTHER_FLOW_SIGNS[type] * amount, '', '', data.ghi_chu));
  return { plan: plan, message: 'Đã ghi ' + type.toLowerCase() + ' ' + formatShortVnd(amount) + '.' };
}

/** Counted money vs. the book; the gap is booked so the cash figure always matches reality. */
function planReconcile(data, ctx) {
  if (!ctx.ledger.some(function (row) { return row.loai === LEDGER.opening; })) fail('Chưa có số dư đầu kỳ. Nhập "Đầu kỳ" trước.');
  if (data.tien_mat === '' || data.tien_mat == null || data.so_du_tk === '' || data.so_du_tk == null) {
    fail('Nhập cả tiền mặt đếm được và số dư tài khoản (không có thì ghi 0).');
  }
  var actual = readMoney(data.tien_mat, 'tiền mặt', false) + readMoney(data.so_du_tk, 'số dư tài khoản', false);
  var book = ctx.ledger.reduce(function (sum, row) { return sum + toNumberOrZero(row.so_tien); }, 0);
  var diff = actual - book;
  var reason = cleanText(data.ly_do, 40);
  var plan = emptyPlan();
  plan.ledgerRows.push(ledgerRow(ctx, ctx.today, LEDGER.adjust, diff, '', '',
    (diff ? 'Lệch ' + formatVnd(diff) + (reason ? ' · ' + reason : '') : 'Khớp sổ') + '. ' + cleanText(data.ghi_chu, 120)));
  var message = diff === 0 ? 'Khớp sổ, tuyệt vời!' : 'Lệch ' + (diff > 0 ? '+' : '') + formatShortVnd(diff) + ' so với sổ, đã ghi điều chỉnh.';
  return { plan: plan, message: message };
}
