// "Máy & đơn" tab: stock sorted by capital stuck × days, money on its way, last ledger rows.
import { el, card, formatShort, formatSigned, formatPct, formatDayMonth } from './dom-and-format-helpers.js';

function agingStrip(buckets) {
  return el('div', { class: 'aging' }, buckets.map((b) =>
    el('div', {}, el('span', { text: b.label }), el('b', { text: formatShort(b.amount) }), el('span', { class: 'muted', text: `${b.count} máy` }))));
}

function waitChip(item) {
  if (item.maxWaitDays == null) return null;
  return item.maxWaitDays > 0
    ? el('span', { class: 'chip', text: `Chờ giá còn đáng ~${item.maxWaitDays} ngày` })
    : el('span', { class: 'chip chip--warn', text: 'Hết đáng chờ giá' });
}

function stockItem(item, openAction) {
  const alert = item.bigOverHold || item.overAge;
  const advice = item.suggestedPrice
    ? `Gợi ý hạ về ${formatShort(item.suggestedPrice)} (đã hạ ${item.so_lan_ha_gia} lần).`
    : `Giữ thêm 7 ngày phải bán cao hơn ~${formatShort(item.extraPer7)} mới bằng bán ngay.`;
  return el('article', { class: `item${alert ? ' item--alert' : ''}` },
    el('div', { class: 'item__head' },
      el('div', {}, el('p', { class: 'item__name', text: item.model }), el('span', { class: 'item__code', text: `${item.ma_may} · ${item.nhom}${item.imei5 ? ` · …${item.imei5}` : ''}` })),
      el('span', { class: 'item__money', text: formatShort(item.cost) })),
    el('div', { class: 'chips' },
      el('span', { class: `chip${item.overAge ? ' chip--alert' : ''}`, text: `${item.days} ngày (hạn ${item.ageLimit})` }),
      el('span', { class: `chip${item.isBig ? ' chip--warn' : ''}`, text: `${formatPct(item.share)} vốn` }),
      el('span', { class: 'chip', text: `Giữ đã tốn ~${formatShort(item.holdingCost)}` }),
      item.gia_ky_vong ? el('span', { class: 'chip', text: `Kỳ vọng ${formatShort(item.gia_ky_vong)}${item.gia_san ? ` · sàn ${formatShort(item.gia_san)}` : ''}` }) : null,
      waitChip(item)),
    el('p', { class: 'item__advice', text: advice }),
    el('div', { class: 'item__actions' },
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Bán / gửi', onclick: () => openAction('ban', { ma_may: item.ma_may }) }),
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Đổi giá', onclick: () => openAction('ha_gia', { ma_may: item.ma_may }) }),
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Chi sửa', onclick: () => openAction('chi_sua', { ma_may: item.ma_may }) })));
}

function pendingItem(item, openAction) {
  const isCod = item.trang_thai === 'Đang gửi';
  const lateText = isCod ? `${item.days} ngày chưa có tiền` : `Quá hạn ${item.overdueDays} ngày`;
  return el('article', { class: `item${item.overdue ? ' item--alert' : ''}` },
    el('div', { class: 'item__head' },
      el('div', {}, el('p', { class: 'item__name', text: item.model }), el('span', { class: 'item__code', text: `${item.ma_may} · ${item.kenh_ban} · ${item.doi_tac}` })),
      el('span', { class: 'item__money', text: formatShort(item.outstanding) })),
    el('div', { class: 'chips' },
      el('span', { class: `chip${item.overdue ? ' chip--alert' : ''}`, text: item.overdue ? lateText : `Gửi ${item.days} ngày` }),
      item.ma_van_don ? el('span', { class: 'chip', text: `Vận đơn ${item.ma_van_don}` }) : null,
      item.han_tra ? el('span', { class: 'chip', text: `Hạn trả ${formatDayMonth(item.han_tra)}` }) : null,
      el('span', { class: 'chip', text: `Giá bán ${formatShort(item.gia_ban)}` })),
    el('div', { class: 'item__actions' },
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Tiền về', onclick: () => openAction('tien_ve', { nguon: isCod ? 'COD' : 'Mối', [isCod ? 'doi_tac_cod' : 'doi_tac_moi']: item.doi_tac, ma_may_list: [item.ma_may] }) }),
      el('button', { class: 'btn btn--ghost', type: 'button', text: isCod ? 'Hoàn hàng' : 'Mối trả máy', onclick: () => openAction('hoan', { ma_may: item.ma_may }) })));
}

function ledgerList(rows) {
  if (!rows.length) return el('p', { class: 'muted', text: 'Chưa có dòng nào.' });
  return el('div', {}, rows.map((row) => el('div', { class: 'ledger-row' },
    el('span', { class: 'muted', text: formatDayMonth(row.ngay) }),
    el('span', { text: `${row.loai}${row.ma_may ? ` · ${row.ma_may}` : ''}${row.ghi_chu ? ` · ${row.ghi_chu}` : ''}` }),
    el('b', { class: row.so_tien < 0 ? 'neg' : 'pos', text: formatSigned(row.so_tien) }))));
}

export function renderLists(container, payload, openAction) {
  const dash = payload.dashboard;
  container.replaceChildren(
    card(`Máy tồn · ${dash.stockList.length} máy · ${formatShort(dash.buckets.stock)}`,
      agingStrip(dash.stockAging),
      dash.stockList.length ? dash.stockList.map((item) => stockItem(item, openAction)) : el('p', { class: 'muted', text: 'Không có máy tồn.' }),
      el('p', { class: 'card__hint', text: 'Xếp theo vốn × số ngày bị kẹt: máy trên cùng nên xử lý trước.' })),
    card(`Chờ thu · ${dash.pendingList.length} máy · ${formatShort(dash.buckets.receivable)}`,
      agingStrip(dash.pendingAging),
      dash.pendingList.length ? dash.pendingList.map((item) => pendingItem(item, openAction)) : el('p', { class: 'muted', text: 'Không có đơn chờ tiền.' })),
    card('Vừa nhập gần đây', ledgerList(payload.recentLedger),
      el('p', { class: 'card__hint', text: 'Nhập nhầm? Sửa thẳng trong Google Sheet (tab May / SoTien), rồi đối chiếu số dư.' }))
  );
}
