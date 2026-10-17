// End-to-end owner journey through the pure planners: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, day, applyPlan } from './load-apps-script-sandbox.mjs';

const gs = loadGs();
const TODAY = day('2026-10-18');

function freshState() {
  return { machines: [], ledger: [], seq: 0 };
}

function run(state, action, data) {
  // Like the Sheet counter: a code is only used up when a machine is really created.
  const ctx = {
    machines: state.machines, ledger: state.ledger, config: gs.resolveConfig({}),
    today: TODAY, now: new Date(2026, 9, 18, 9, 0), newCode: 'M' + String(state.seq + 1).padStart(4, '0')
  };
  const result = gs.planAction(action, data, ctx);
  if (result.ok) {
    applyPlan(state, result.plan);
    if (gs.ACTIONS_CREATING_MACHINE.includes(action)) state.seq += 1;
  }
  return result;
}

const cash = (state) => state.ledger.reduce((sum, row) => sum + row.so_tien, 0);
const machine = (state, code) => state.machines.find((m) => m.ma_may === code);

test('opening, buy, repair, COD with deposit, remittance with fee: cash and profit add up', () => {
  const s = freshState();
  assert.equal(run(s, 'dau_ky', { tien_mat: 20000000, so_du_tk: 80000000 }).ok, true);
  assert.equal(cash(s), 100000000);
  assert.match(run(s, 'dau_ky', { tien_mat: 1 }).error, /Đã có số dư đầu kỳ/);

  run(s, 'mua', { nhom: 'iPhone', model: 'iPhone 13 Pro 128GB', gia_mua: 12000000, gia_ky_vong: 14500000, gia_san: 13500000 });
  assert.equal(machine(s, 'M0001').trang_thai, 'Tồn');
  assert.equal(cash(s), 88000000);

  run(s, 'chi_sua', { ma_may: 'm0001', so_tien: 500000, ghi_chu: 'thay pin' });
  assert.equal(gs.machineCost(machine(s, 'M0001')), 12500000);

  const sale = run(s, 'ban', { ma_may: 'M0001', kenh_ban: 'COD', gia_ban: 14000000, tien_coc: 1000000, doi_tac: 'GHTK', ma_van_don: 'S123' });
  assert.equal(sale.ok, true);
  assert.match(sale.message, /chờ thu 13tr/);
  assert.equal(machine(s, 'M0001').trang_thai, 'Đang gửi');
  assert.equal(gs.machineOutstanding(machine(s, 'M0001')), 13000000);
  assert.equal(cash(s), 88500000);

  assert.match(run(s, 'tien_ve', { nguon: 'COD', ma_may_list: ['M0001'], tong_nhan: 13500000 }).error, /lớn hơn tổng thu hộ/);
  const remit = run(s, 'tien_ve', { nguon: 'COD', ma_may_list: ['M0001'], tong_nhan: 12970000 });
  assert.equal(remit.ok, true);
  const sold = machine(s, 'M0001');
  assert.equal(sold.trang_thai, 'Đã thu');
  assert.equal(sold.phi_ship, 30000);
  assert.equal(gs.machineProfit(sold), 1470000);
  assert.equal(cash(s), 101470000);
});

test('COD fee is split across parcels by value and sums exactly', () => {
  const s = freshState();
  run(s, 'dau_ky', { tien_mat: 0, so_du_tk: 50000000 });
  for (const price of [10000000, 5000000]) {
    run(s, 'mua', { nhom: 'iPhone', model: 'X', gia_mua: price - 1000000 });
  }
  run(s, 'ban', { ma_may: 'M0001', kenh_ban: 'COD', gia_ban: 10000000, doi_tac: 'J&T' });
  run(s, 'ban', { ma_may: 'M0002', kenh_ban: 'COD', gia_ban: 5000000, doi_tac: 'J&T' });
  run(s, 'tien_ve', { nguon: 'COD', ma_may_list: ['M0001', 'M0002'], tong_nhan: 14910001 });
  const fees = machine(s, 'M0001').phi_ship + machine(s, 'M0002').phi_ship;
  assert.equal(fees, 89999);
  assert.equal(machine(s, 'M0001').phi_ship, 59999);
});

test('dealer credit: partial pay keeps the debt, full pay closes it oldest first', () => {
  const s = freshState();
  run(s, 'dau_ky', { tien_mat: 0, so_du_tk: 30000000 });
  run(s, 'mua', { nhom: 'Laptop', model: 'MacBook Air M1', gia_mua: 8000000, co_san: true, ngay: '2026-10-01' });
  assert.equal(cash(s), 30000000, 'existing stock does not move cash');
  const sale = run(s, 'ban', { ma_may: 'M0001', kenh_ban: 'Mối', gia_ban: 9000000, doi_tac: 'Anh Hùng', da_tra: 4000000 });
  assert.match(sale.message, /nợ 5tr, hạn 21\/10/);
  assert.equal(machine(s, 'M0001').trang_thai, 'Nợ mối');
  assert.match(run(s, 'tien_ve', { nguon: 'Mối', doi_tac: 'Anh Hùng', tong_nhan: 6000000 }).error, /nhiều hơn số đang nợ/);
  assert.match(run(s, 'hoan', { ma_may: 'M0001' }).error, /Mối đã trả 4tr/);
  run(s, 'tien_ve', { nguon: 'Mối', doi_tac: 'Anh Hùng', tong_nhan: 2000000 });
  assert.equal(machine(s, 'M0001').trang_thai, 'Nợ mối');
  run(s, 'tien_ve', { nguon: 'Mối', doi_tac: 'Anh Hùng', tong_nhan: 3000000 });
  assert.equal(machine(s, 'M0001').trang_thai, 'Đã thu');
  assert.equal(cash(s), 39000000);
});

test('returned parcel: back to stock, buy date kept, kept deposit offsets the lost fee', () => {
  const s = freshState();
  run(s, 'dau_ky', { tien_mat: 0, so_du_tk: 20000000 });
  run(s, 'mua', { nhom: 'iPhone', model: 'iPhone 12', gia_mua: 10000000, ngay: '2026-10-05' });
  run(s, 'ban', { ma_may: 'M0001', kenh_ban: 'COD', gia_ban: 11000000, tien_coc: 500000, doi_tac: 'GHTK' });
  const back = run(s, 'hoan', { ma_may: 'M0001', phi_hoan: 60000, tra_phi_ngay: true });
  assert.equal(back.ok, true);
  const m = machine(s, 'M0001');
  assert.equal(m.trang_thai, 'Tồn');
  assert.equal(m.gia_ban, '');
  assert.equal(m.ngay_mua.getDate(), 5);
  assert.equal(gs.machineCost(m), 9560000);
  assert.equal(cash(s), 20000000 - 10000000 + 500000 - 60000);
});

test('return fee deducted by the carrier later: cash moves only once, at the remittance', () => {
  const s = freshState();
  run(s, 'dau_ky', { tien_mat: 0, so_du_tk: 30000000 });
  run(s, 'mua', { nhom: 'iPhone', model: 'A', gia_mua: 10000000 });
  run(s, 'mua', { nhom: 'iPhone', model: 'B', gia_mua: 8000000 });
  run(s, 'ban', { ma_may: 'M0001', kenh_ban: 'COD', gia_ban: 11000000, doi_tac: 'GHTK' });
  run(s, 'ban', { ma_may: 'M0002', kenh_ban: 'COD', gia_ban: 9000000, doi_tac: 'GHTK' });
  run(s, 'hoan', { ma_may: 'M0001', phi_hoan: 60000 });
  assert.equal(cash(s), 12000000, 'return itself moves no cash');
  assert.equal(run(s, 'doi_chieu', { tien_mat: 0, so_du_tk: 12000000 }).message, 'Khớp sổ, tuyệt vời!');
  // Carrier pays parcel B (9tr) minus 30k COD fee minus the 60k return fee of A.
  run(s, 'tien_ve', { nguon: 'COD', ma_may_list: ['M0002'], tong_nhan: 8910000, phi_hoan_tru: 60000 });
  assert.equal(cash(s), 12000000 + 8910000);
  assert.equal(machine(s, 'M0002').phi_ship, 30000);
  assert.equal(gs.machineCost(machine(s, 'M0001')), 10060000);
});

test('opening with an existing loan: cash = counted money, debt recorded', () => {
  const s = freshState();
  run(s, 'dau_ky', { tien_mat: 5000000, so_du_tk: 45000000, no_vay: 20000000 });
  assert.equal(cash(s), 50000000);
  const b = gs.computeBuckets([], s.ledger);
  assert.equal(b.debt, 20000000);
  assert.equal(b.equity, 30000000);
});

test('trade-in books one sale and one purchase; cash moves by the difference', () => {
  const s = freshState();
  run(s, 'dau_ky', { tien_mat: 5000000, so_du_tk: 0 });
  run(s, 'mua', { nhom: 'iPhone', model: 'iPhone 14', gia_mua: 15000000, co_san: true });
  const swap = run(s, 'doi_may', { ma_may: 'M0001', gia_ban: 17000000, nhom: 'iPhone', model: 'iPhone 11', gia_nhan: 6000000 });
  assert.match(swap.message, /khách bù 11tr/);
  assert.equal(machine(s, 'M0001').trang_thai, 'Đã thu');
  assert.equal(machine(s, 'M0002').gia_mua, 6000000);
  assert.equal(cash(s), 16000000);
});

test('reconcile books the gap; other flows take their sign from the type', () => {
  const s = freshState();
  assert.match(run(s, 'doi_chieu', { tien_mat: 1, so_du_tk: 1 }).error, /Kiểm kê đầu kỳ" trước/);
  assert.match(run(s, 'mua', { nhom: 'iPhone', model: 'A', gia_mua: 1000000 }).error, /Kiểm kê đầu kỳ" trước/);
  run(s, 'dau_ky', { tien_mat: 10000000, so_du_tk: 0 });
  run(s, 'thu_chi', { loai: 'Rút cá nhân', so_tien: 2000000 });
  assert.equal(cash(s), 8000000);
  assert.match(run(s, 'doi_chieu', { tien_mat: 7500000 }).error, /Nhập cả/);
  const rec = run(s, 'doi_chieu', { tien_mat: 7500000, so_du_tk: 0, ly_do: 'tiêu cá nhân' });
  assert.match(rec.message, /Lệch -500k/);
  assert.equal(cash(s), 7500000);
  assert.match(run(s, 'doi_chieu', { tien_mat: 7500000, so_du_tk: 0 }).message, /Khớp sổ/);
});

test('guards: unknown action, future date, wrong status, bad money, floor above expected', () => {
  const s = freshState();
  run(s, 'dau_ky', { tien_mat: 0, so_du_tk: 10000000 });
  assert.equal(run(s, 'xoa_het', {}).ok, false);
  assert.equal(run(s, 'constructor', {}).ok, false);
  assert.match(run(s, 'mua', { nhom: 'iPhone', model: 'A', gia_mua: 900000000 }).error, /quá lớn/);
  assert.match(run(s, 'mua', { nhom: 'iPhone', model: 'A', gia_mua: 1000000, ngay: '2026-10-19' }).error, /tương lai/);
  assert.match(run(s, 'mua', { nhom: 'Điện thoại lạ', model: 'A', gia_mua: 1000000 }).error, /nhóm máy/);
  assert.match(run(s, 'mua', { nhom: 'iPhone', model: 'A', gia_mua: -5 }).error, /không hợp lệ/);
  assert.match(run(s, 'mua', { nhom: 'iPhone', model: 'A', gia_mua: 1000000, gia_ky_vong: 2000000, gia_san: 3000000 }).error, /Giá sàn/);
  run(s, 'mua', { nhom: 'iPhone', model: 'A', gia_mua: 1000000 });
  run(s, 'ban', { ma_may: 'M0001', kenh_ban: 'Tại chỗ', gia_ban: 1200000 });
  assert.match(run(s, 'ban', { ma_may: 'M0001', kenh_ban: 'Tại chỗ', gia_ban: 1200000 }).error, /trạng thái "Đã thu"/);
  assert.match(run(s, 'hoan', { ma_may: 'M0001' }).error, /trạng thái/);
  run(s, 'mua', { nhom: 'iPhone', model: 'B', gia_mua: 1000000, ngay: '2026-10-10' });
  assert.match(run(s, 'ban', { ma_may: 'M0002', kenh_ban: 'Tại chỗ', gia_ban: 1, ngay: '2026-10-09' }).error, /trước ngày mua/);
  assert.match(run(s, 'ban', { ma_may: 'M0002', kenh_ban: 'COD', gia_ban: 1200000, doi_tac: 'Hãng lạ' }).error, /hãng vận chuyển/);
});
