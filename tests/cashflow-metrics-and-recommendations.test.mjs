// Dashboard maths and advice rules on a hand-checked scenario: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, day } from './load-apps-script-sandbox.mjs';

// Sandbox arrays come from another realm; compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

const gs = loadGs();
const TODAY = day('2026-10-18');
const config = gs.resolveConfig({});

// 5 finished sales: cost 10tr, profit 1tr, 7 days in stock + 3 days waiting for money.
const finished = Array.from({ length: 5 }, (_, i) => ({
  ma_may: `M00${10 + i}`, nhom: 'iPhone', model: 'iPhone 12', trang_thai: 'Đã thu',
  ngay_mua: day('2026-10-01'), ngay_ban: day('2026-10-08'), ngay_tien_ve: day('2026-10-11'),
  gia_mua: 10000000, chi_phi_them: 0, gia_ban: 11000000, da_thu: 11000000, phi_ship: 0, chi_phi_bao_hanh: 0
}));
const bigStock = {
  ma_may: 'M0001', nhom: 'iPhone', model: 'iPhone 15 Pro Max', trang_thai: 'Tồn', ngay_mua: day('2026-09-28'),
  gia_mua: 29500000, chi_phi_them: 500000, gia_ky_vong: 34000000, gia_san: 32000000, so_lan_ha_gia: 0
};
const smallStock = {
  ma_may: 'M0002', nhom: 'iPhone', model: 'iPhone 11', trang_thai: 'Tồn', ngay_mua: day('2026-10-15'),
  gia_mua: 5000000, chi_phi_them: 0, gia_ky_vong: 6000000, gia_san: 5500000
};
const codLate = {
  ma_may: 'M0003', nhom: 'Laptop', model: 'MacBook Air M1', trang_thai: 'Đang gửi', kenh_ban: 'COD', doi_tac: 'GHTK',
  ma_van_don: 'S9', ngay_mua: day('2026-10-01'), ngay_ban: day('2026-10-08'), gia_mua: 9000000, gia_ban: 11000000, tien_coc: 1000000, da_thu: 1000000, phi_ship: 0
};
const dealerLate = {
  ma_may: 'M0004', nhom: 'Laptop', model: 'Dell XPS', trang_thai: 'Nợ mối', kenh_ban: 'Mối', doi_tac: 'Anh Hùng',
  ngay_mua: day('2026-10-01'), ngay_ban: day('2026-10-12'), han_tra: day('2026-10-15'), gia_mua: 6000000, gia_ban: 7000000, da_thu: 3000000, phi_ship: 0
};
const machines = [...finished, bigStock, smallStock, codLate, dealerLate];
const ledger = [
  { ngay: day('2026-08-01'), loai: 'Đầu kỳ', so_tien: 45000000 },
  { ngay: day('2026-10-15'), loai: 'Mua máy', so_tien: -5000000, ma_may: 'M0002' },
  { ngay: day('2026-10-16'), loai: 'Điều chỉnh', so_tien: 0 }
];

test('buckets keep cash, money on its way and stock at cost apart', () => {
  const b = gs.computeBuckets(machines, ledger);
  assert.deepEqual({ ...b }, { cash: 40000000, receivable: 14000000, stock: 35000000, debt: 0, equity: 89000000 });
});

test('r, cycle, working capital and max buy today', () => {
  const dash = gs.computeDashboard(machines, ledger, [], config, TODAY);
  const k = dash.kpis;
  assert.equal(k.rSource, 'thuc_te');
  assert.ok(Math.abs(k.r - 0.01) < 1e-12);
  assert.equal(k.dio, 7);
  assert.equal(k.dso, 3);
  assert.equal(k.ccc, 10);
  assert.ok(Math.abs(k.cogsPerDay - 50000000 / 79) < 1e-6, 'young ledger averages over the 79 tracked days');
  assert.equal(Math.round(k.buffer), 13350000);
  assert.equal(Math.round(k.maxBuyToday), 26650000);
  assert.equal(dash.daysSinceReconcile, 2);
  assert.deepEqual(plain(dash.pendingAging.map((a) => a.amount)), [0, 4000000, 10000000]);
});

test('big old machine: holding cost, carry per week, how long waiting is still worth it', () => {
  const dash = gs.computeDashboard(machines, ledger, [], config, TODAY);
  const big = dash.stockList[0];
  assert.equal(big.ma_may, 'M0001', 'most capital-days first');
  assert.equal(big.days, 20);
  assert.equal(big.isBig, true);
  assert.equal(big.bigOverHold, true);
  assert.equal(big.holdingCost, 6000000);
  assert.equal(big.dailyCarry, 332000);
  assert.equal(big.extraPer7, 2324000);
  assert.equal(big.maxWaitDays, 6);
  assert.equal(big.suggestedPrice, 33000000);
});

test('month bridge shows where this month cash went', () => {
  const bridge = gs.computeDashboard(machines, ledger, [], config, TODAY).monthBridge;
  assert.equal(bridge.openingCash, 45000000);
  assert.deepEqual(plain(bridge.lines.map((l) => [l.label, l.amount])), [['Mua máy', -5000000]]);
  assert.equal(bridge.closingCash, 40000000);
  assert.equal(bridge.profitRealized, 5000000);
});

test('recommendations: act on the big machine first, then late COD and late dealer', () => {
  const dash = gs.computeDashboard(machines, ledger, [], config, TODAY);
  const recs = gs.buildRecommendations(dash, config);
  assert.equal(recs[0].level, 'do');
  assert.match(recs[0].title, /Xả iPhone 15 Pro Max \(M0001\): chiếm 34% vốn, 20 ngày/);
  assert.match(recs[0].detail, /hạ về 33tr/);
  assert.ok(recs.some((r) => /đơn COD quá 7 ngày/.test(r.title)));
  assert.ok(recs.some((r) => /Mối Anh Hùng quá hạn: còn nợ 4tr/.test(r.title)));
  assert.ok(recs.length <= 5);
});

test('empty sheet: default r, no cycle yet, first step is the opening count', () => {
  const dash = gs.computeDashboard([], [], [], config, TODAY);
  assert.equal(dash.kpis.rSource, 'mac_dinh');
  assert.equal(dash.kpis.ccc, null);
  assert.equal(dash.kpis.wcNeeded, null);
  const recs = gs.buildRecommendations(dash, config);
  assert.equal(recs.length, 1);
  assert.match(recs[0].title, /kiểm kê đầu kỳ/);
});

test('cash below buffer stops buying; quiet business gets a green light', () => {
  const lowCash = [{ ngay: day('2026-10-01'), loai: 'Đầu kỳ', so_tien: 500000 }, { ngay: day('2026-10-17'), loai: 'Điều chỉnh', so_tien: 0 }];
  const recs = gs.buildRecommendations(gs.computeDashboard([smallStock], lowCash, [], config, TODAY), config);
  assert.match(recs[0].title, /Tiền dưới mức đệm/);
  const calm = [{ ngay: day('2026-10-01'), loai: 'Đầu kỳ', so_tien: 50000000 }, { ngay: day('2026-10-17'), loai: 'Điều chỉnh', so_tien: 0 }];
  const ok = gs.buildRecommendations(gs.computeDashboard([smallStock], calm, [], config, TODAY), config);
  assert.equal(ok[0].level, 'xanh');
  assert.match(ok[0].detail, /mua được tối đa 16,5tr/);
});

test('helpers: short money, slug, Config numbers typed as text', () => {
  assert.equal(gs.formatShortVnd(12500000), '12,5tr');
  assert.equal(gs.formatShortVnd(-500000), '-500k');
  assert.equal(gs.slugify('Khác'), 'khac');
  const c = gs.resolveConfig({ von_dem_pct: '0.2', canh_bao_ton_ngay_apple_watch: 8 });
  assert.equal(c.von_dem_pct, 0.2);
  assert.equal(gs.ageLimitForGroup(c, 'Apple Watch'), 8);
  assert.equal(gs.ageLimitForGroup(c, 'Loa'), 15);
  assert.equal(gs.resolveConfig({ von_dem_pct: '20%' }).von_dem_pct, 0.2);
  assert.equal(gs.resolveConfig({ von_dem_pct: '0,25' }).von_dem_pct, 0.25);
});
