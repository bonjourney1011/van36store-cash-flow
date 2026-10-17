// Phone-style money input and the JSON payload sent to the page: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney } from '../assets/js/money-input-parser.js';
import { loadGs, day } from './load-apps-script-sandbox.mjs';

test('money typed the way the owner talks', () => {
  const cases = {
    '12tr5': 12500000, '12tr55': 12550000, '12,5tr': 12500000, '12.5 tr': 12500000, '12 triệu': 12000000,
    '800k': 800000, '1,5k': 1500, '12.500.000': 12500000, '12,500,000đ': 12500000, '12500000': 12500000,
    '12': 12000000, '0,5': 500000, '0': 0, '3 củ': 3000000
  };
  for (const [text, expected] of Object.entries(cases)) assert.equal(parseMoney(text), expected, text);
  for (const bad of ['', 'abc', '12tr5k', '1.2.3', null]) assert.equal(parseMoney(bad), null, String(bad));
  // Fee fields count bare numbers in thousands: "300" = 300k, "1500" = 1,5tr.
  assert.equal(parseMoney('300', 'k'), 300000);
  assert.equal(parseMoney('1500', 'k'), 1500000);
  assert.equal(parseMoney('2tr', 'k'), 2000000);
  assert.equal(parseMoney('250000', 'k'), 250000);
});

test('dashboard payload is JSON-safe: dates leave as yyyy-mm-dd, today point appended once', () => {
  const gs = loadGs();
  const today = day('2026-10-18');
  const state = {
    config: gs.resolveConfig({}),
    machines: [
      { ma_may: 'M0001', nhom: 'iPhone', model: 'iPhone 12', trang_thai: 'Đã thu', kenh_ban: 'Mối', doi_tac: 'Anh Hùng',
        ngay_mua: day('2026-10-01'), ngay_ban: day('2026-10-05'), ngay_tien_ve: day('2026-10-06'), gia_mua: 8000000, gia_ban: 9000000, da_thu: 9000000 },
      { ma_may: 'M0002', nhom: 'Laptop', model: 'MacBook Air', trang_thai: 'Nợ mối', kenh_ban: 'Mối', doi_tac: 'Chị Lan',
        ngay_mua: day('2026-10-01'), ngay_ban: day('2026-10-10'), han_tra: day('2026-10-13'), gia_mua: 9000000, gia_ban: 10000000, da_thu: 0 }
    ],
    ledger: [{ ngay: day('2026-10-01'), loai: 'Đầu kỳ', so_tien: 50000000, ma_may: '', ghi_chu: '' }],
    snapshots: [
      { ngay: day('2026-10-17'), tien: 40000000, cho_thu: 1, may_ton: 2, von_chu: 3 },
      { ngay: day('2026-10-18'), tien: 1, cho_thu: 1, may_ton: 1, von_chu: 1 }
    ]
  };
  const payload = JSON.parse(JSON.stringify(gs.buildDashboardPayload(state, today)));
  assert.deepEqual(payload.trend.map((p) => p.ngay), ['2026-10-17', '2026-10-18']);
  assert.equal(payload.trend[1].tien, 50000000, 'live numbers replace the morning snapshot of today');
  assert.equal(payload.sold[0].ngay_tien_ve, '2026-10-06');
  assert.equal(payload.dashboard.pendingList[0].han_tra, '2026-10-13');
  assert.deepEqual(payload.lists.dealers, ['Chị Lan', 'Anh Hùng']);
  assert.equal(payload.recentLedger[0].ngay, '2026-10-01');
  assert.ok(!JSON.stringify(payload).includes('T17:00:00'), 'no UTC-shifted Date leaks into the payload');
});
