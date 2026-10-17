// "Nhịp quay vốn": cash cycle, return per đồng per day, working capital needed, per-group table.
import { el, card, formatShort, formatPct } from './dom-and-format-helpers.js';

const days = (value) => (value == null ? '–' : `${Math.round(value)} ngày`);

function kpi(label, value, note, wide) {
  return el('div', { class: `kpi${wide ? ' kpi--wide' : ''}` },
    el('p', { class: 'kpi__label', text: label }),
    el('p', { class: 'kpi__value', text: value }),
    note ? el('p', { class: 'kpi__note', text: note }) : null);
}

function workingCapitalKpi(k, equity) {
  if (k.wcNeeded == null) return kpi('Vốn lưu động cần', '–', 'Cần vài máy bán xong (tiền đã về) để tính.', true);
  const gap = k.wcGap;
  const note = gap >= 0
    ? `Đang có ${formatShort(equity)} → dư ~${formatShort(gap)}, có thể nhập thêm nếu máy quay nhanh.`
    : `Đang có ${formatShort(equity)} → thiếu ~${formatShort(-gap)}. Rút ngắn chu kỳ trước khi nhập thêm.`;
  return kpi('Vốn lưu động cần (giá vốn bán/ngày × chu kỳ + đệm)', formatShort(k.wcNeeded), note, true);
}

function groupTable(groups) {
  const rows = groups.filter((g) => g.count > 0);
  if (!rows.length) return null;
  return el('div', { class: 'table-scroll' }, el('table', { class: 'mini-table' },
    el('thead', {}, el('tr', {}, ['Nhóm', 'Bán xong (90 ngày)', 'Tồn TB', 'Lãi/ngày/1tr vốn'].map((h) => el('th', { text: h })))),
    el('tbody', {}, rows.map((g) => el('tr', {},
      el('td', { text: g.nhom }),
      el('td', { text: String(g.count) }),
      el('td', { text: days(g.dio) }),
      el('td', { text: g.r == null ? 'chưa đủ' : formatShort(g.r * 1e6) }))))));
}

export function renderCycleCard(dash) {
  const k = dash.kpis;
  const rNote = k.rSource === 'thuc_te'
    ? `Từ ${k.sampleSize} máy bán xong 90 ngày qua. ≈ ${formatPct(k.r * 30, 1)}/tháng.`
    : 'Số tạm từ Config: cần ≥ 5 máy bán xong để đo thật.';
  return card('Nhịp quay vốn',
    el('div', { class: 'kpis' },
      kpi('Chu kỳ tiền', days(k.ccc), k.ccc == null ? 'Chưa có máy bán xong.' : `Nằm kho ${days(k.dio)} + chờ tiền ${days(k.dso)}`),
      kpi('Lãi mỗi ngày trên 1tr vốn', formatShort(k.r * 1e6), rNote),
      kpi('Lãi đã thu 30 ngày', formatShort(k.profit30), k.turnover30 == null ? null : `Vốn quay ${String(Math.round(k.turnover30 * 10) / 10).replace('.', ',')} vòng/tháng`),
      kpi('Tiền đọng trong máy', formatPct(k.stockShare), 'so với vốn chủ'),
      workingCapitalKpi(k, dash.buckets.equity)),
    groupTable(k.groups),
    el('p', { class: 'card__hint', text: 'Giữ 1 máy thêm 1 ngày tốn đúng phần lãi mà số vốn đó lẽ ra kiếm được. Đó là lý do "đợi giá" có chi phí.' }));
}
