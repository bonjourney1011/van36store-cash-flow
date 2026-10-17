// Shared building blocks for the action forms: machine pickers and common fields.
import { formatShort } from './dom-and-format-helpers.js';

export const stockPicks = (p) => p.dashboard.stockList.map((s) => ({
  code: s.ma_may, title: s.model, sub: `${s.ma_may} · vốn ${formatShort(s.cost)} · ${s.days} ngày${s.gia_ky_vong ? ` · kỳ vọng ${formatShort(s.gia_ky_vong)}` : ''}`
}));
export const pendingPicks = (p, status, partner) => p.dashboard.pendingList
  .filter((item) => item.trang_thai === status && (!partner || item.doi_tac === partner))
  .map((item) => ({ code: item.ma_may, title: item.model, sub: `${item.ma_may} · ${item.doi_tac} · chờ ${formatShort(item.outstanding)} · ${item.days} ngày`, amount: item.outstanding }));
export const openPicks = (p) => [...stockPicks(p), ...pendingPicks(p, 'Đang gửi'), ...pendingPicks(p, 'Nợ mối')];
export const soldPicks = (p) => [
  ...p.sold.map((s) => ({ code: s.ma_may, title: s.model, sub: `${s.ma_may} · bán ${formatShort(s.gia_ban)} · lãi ${formatShort(s.profit)}` })),
  ...pendingPicks(p, 'Đang gửi'), ...pendingPicks(p, 'Nợ mối')
];
export const creditDealers = (p) => [...new Set(p.dashboard.pendingList.filter((i) => i.trang_thai === 'Nợ mối').map((i) => i.doi_tac))];
export const findStock = (p, code) => p.dashboard.stockList.find((s) => s.ma_may === code);

export const newMachineFields = (priceName, priceLabel) => [
  { name: 'nhom', label: 'Nhóm máy', type: 'choice', required: true, options: (p) => p.lists.groups },
  { name: 'model', label: 'Tên máy', type: 'text', required: true, placeholder: 'VD iPhone 13 Pro 128GB', suggestions: (p) => p.lists.models },
  { name: priceName, label: priceLabel, type: 'money', required: true },
  { name: 'gia_ky_vong', label: 'Giá kỳ vọng bán', type: 'money', hint: 'Nên điền: để tính chờ giá còn đáng bao lâu.' },
  { name: 'gia_san', label: 'Giá sàn (bán ngay được)', type: 'money', more: true },
  { name: 'imei5', label: '5 số cuối IMEI / serial', type: 'text', more: true },
  { name: 'tinh_trang', label: 'Tình trạng', type: 'text', more: true, placeholder: 'VD pin 86%, xước nhẹ' }
];
export const dateField = { name: 'ngay', label: 'Ngày (để trống = hôm nay)', type: 'date', more: true };
export const noteField = { name: 'ghi_chu', label: 'Ghi chú', type: 'text', more: true };
