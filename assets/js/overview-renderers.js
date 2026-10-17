// "Tổng quan" tab: cash first, where the money sits, what to do, where this month's cash went.
import { el, card, formatShort, formatSigned, formatPct } from './dom-and-format-helpers.js';
import { renderTrendChart } from './trend-chart.js';
import { renderCycleCard } from './cycle-kpi-renderers.js';

const LEVEL_TEXT = { do: ['!', 'Làm ngay'], vang: ['?', 'Để ý tuần này'], xanh: ['✓', 'Ổn'] };

function heroCard(dash) {
  const { buckets: b, kpis: k } = dash;
  return el('section', { class: 'card hero' },
    el('p', { class: 'hero__label', text: 'Tiền đang có (mặt + tài khoản)' }),
    el('p', { class: 'hero__value', text: formatShort(b.cash) }),
    el('p', { class: 'card__hint', text: `Chỉ ${formatPct(k.cashShare)} tổng tài sản là tiền dùng được ngay.` }),
    el('div', { class: 'hero__sub' },
      el('div', { class: 'hero__pill' }, el('small', { text: 'Hôm nay mua máy tối đa' }), el('b', { text: formatShort(k.maxBuyToday) })),
      el('div', { class: 'hero__pill' }, el('small', { text: `Luôn giữ đệm (${formatPct(dash.settings.von_dem_pct)} vốn)` }), el('b', { text: formatShort(k.buffer) }))
    )
  );
}

function compositionCard(dash) {
  const b = dash.buckets;
  const parts = [
    { label: 'Tiền', value: b.cash, color: 'var(--cash)', sub: 'dùng được ngay' },
    { label: 'Chờ thu', value: b.receivable, color: 'var(--incoming)', sub: `COD + mối nợ · ${dash.pendingList.length} máy` },
    { label: 'Máy tồn (giá vốn)', value: b.stock, color: 'var(--stock)', sub: `${dash.stockList.length} máy · tính theo giá mua + sửa` }
  ];
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0) || 1;
  const bar = el('div', { class: 'compo-bar', role: 'img', 'aria-label': parts.map((p) => `${p.label} ${formatShort(p.value)}`).join(', ') },
    parts.filter((p) => p.value > 0).map((p) => el('i', { style: `flex:${p.value / total};background:${p.color}` })));
  const legend = el('ul', { class: 'legend' },
    parts.map((p) => [
      el('li', {}, el('span', { class: 'swatch', style: `background:${p.color}` }), el('span', { text: p.label }),
        el('span', { class: 'value', text: `${formatShort(p.value)} · ${formatPct(Math.max(0, p.value) / total)}` })),
      el('li', {}, el('span', { class: 'sub', text: p.sub }))
    ]),
    b.debt > 0 ? el('li', {}, el('span', { class: 'swatch', style: 'background:var(--debt)' }), el('span', { text: 'Trừ nợ vay' }), el('span', { class: 'value neg', text: `-${formatShort(b.debt)}` })) : null,
    el('li', { class: 'total' }, el('span'), el('span', { text: 'Vốn chủ' }), el('span', { class: 'value', text: formatShort(b.equity) }))
  );
  return card('Tiền đang nằm ở đâu', bar, legend,
    dash.hopedProfit > 0 ? el('p', { class: 'card__hint', text: `Nếu bán hết máy tồn đúng giá kỳ vọng sẽ lãi thêm ~${formatShort(dash.hopedProfit)}, nhưng đó chưa phải tiền.` }) : null);
}

function recommendationsCard(recs) {
  return card('Nên làm gì', el('ul', { class: 'recs' }, recs.map((rec) => {
    const [icon, levelText] = LEVEL_TEXT[rec.level];
    return el('li', { class: `rec rec--${rec.level}` },
      el('span', { class: 'rec__icon', 'aria-hidden': 'true', text: icon }),
      el('div', {},
        el('span', { class: 'rec__level', text: levelText }),
        el('p', { class: 'rec__title', text: rec.title }),
        el('p', { class: 'rec__detail', text: rec.detail })));
  })));
}

function trendCard(trend) {
  const box = el('div', { class: 'chart-box' }, el('canvas', { 'aria-label': 'Biểu đồ tiền, chờ thu và máy tồn theo ngày', role: 'img' }));
  const section = card('Tiền · chờ thu · máy tồn theo ngày', box,
    el('p', { class: 'card__hint', text: trend.length < 2
      ? 'Mỗi sáng 8h hệ thống ghi 1 điểm. Sau vài ngày sẽ thấy tháng "làm nhiều" là tiền tăng hay chỉ máy tăng.'
      : 'Cột xanh dương (tiền) phải lớn dần mới là làm ăn có tiền; nếu chỉ phần máy tồn cao lên là vốn đang bị kẹt.' }));
  requestAnimationFrame(() => renderTrendChart(box.querySelector('canvas'), trend));
  return section;
}

function bridgeCard(bridge) {
  const rows = [
    el('li', { class: 'bridge__edge' }, el('span', { text: 'Tiền đầu tháng' }), el('span', { text: formatShort(bridge.openingCash) })),
    ...bridge.lines.map((line) => el('li', {}, el('span', { text: line.label }),
      el('span', { class: line.amount < 0 ? 'neg' : 'pos', text: formatSigned(line.amount) }))),
    el('li', { class: 'bridge__edge' }, el('span', { text: 'Tiền hiện tại' }), el('span', { text: formatShort(bridge.closingCash) }))
  ];
  const tied = bridge.tiedUpStart == null ? null : bridge.tiedUpNow - bridge.tiedUpStart;
  const hint = [`Lãi đã thu về trong tháng: ${formatShort(bridge.profitRealized)}.`];
  if (tied != null) hint.push(`Tiền đọng thêm vào máy + chờ thu: ${formatSigned(tied)}.`);
  return card(`Tiền tháng ${bridge.monthLabel} đi đâu`, el('ul', { class: 'bridge' }, rows),
    el('p', { class: 'card__hint', text: hint.join(' ') }));
}

export function renderOverview(container, payload) {
  const dash = { ...payload.dashboard, settings: payload.settings };
  container.replaceChildren(
    heroCard(dash),
    recommendationsCard(payload.recommendations),
    compositionCard(dash),
    trendCard(payload.trend),
    bridgeCard(dash.monthBridge),
    renderCycleCard(dash)
  );
}
