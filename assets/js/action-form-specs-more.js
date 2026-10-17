// Declarative forms for the less frequent actions (repair, return, trade-in, re-price, warranty, other flows).
import { formatShort } from './dom-and-format-helpers.js';
import { stockPicks, pendingPicks, openPicks, soldPicks, findStock, newMachineFields, dateField, noteField } from './action-form-pickers.js';

export const MORE_ACTION_SPECS = {
  chi_sua: {
    title: 'Chi sửa / linh kiện', icon: '🔧', submit: 'Lưu chi phí',
    fields: [
      { name: 'ma_may', label: 'Máy', type: 'machine', required: true, source: openPicks },
      { name: 'so_tien', label: 'Số tiền', type: 'money', unit: 'k', required: true },
      { name: 'ghi_chu', label: 'Sửa gì', type: 'text', placeholder: 'VD thay pin' },
      dateField
    ],
    hint: () => 'Tiền sửa được cộng vào giá vốn của máy, để lãi tính đúng.'
  },
  hoan: {
    title: 'Hoàn hàng', icon: '↩️', submit: 'Lưu máy về kho',
    fields: [
      { name: 'ma_may', label: 'Đơn bị hoàn / máy mối trả lại', type: 'machine', required: true,
        source: (p) => [...pendingPicks(p, 'Đang gửi'), ...pendingPicks(p, 'Nợ mối')] },
      { name: 'phi_hoan', label: 'Phí mất (ship 2 chiều)', type: 'money', unit: 'k' },
      { name: 'tra_phi_ngay', label: 'Đã tự trả phí hoàn bằng tiền (không phải hãng trừ sau)', type: 'toggle' },
      { name: 'tra_coc', label: 'Đã trả lại cọc cho khách', type: 'toggle' },
      noteField, dateField
    ],
    hint: (p, v) => `Máy quay lại "Tồn", giữ ngày mua cũ; phí mất cộng vào giá vốn. ${v.tra_phi_ngay
      ? 'Phí trừ vào tiền ngay.' : 'Hãng trừ phí sau: khi bấm "Tiền về" nhớ ghi "Phí hoàn hãng trừ".'}`
  },
  doi_may: {
    title: 'Thu cũ đổi mới', icon: '🔄', submit: 'Lưu đổi máy',
    fields: [
      { name: 'ma_may', label: 'Máy đưa khách', type: 'machine', required: true, source: stockPicks },
      { name: 'gia_ban', label: 'Giá bán máy đưa khách', type: 'money', required: true },
      ...newMachineFields('gia_nhan', 'Giá định máy nhận về'),
      dateField
    ],
    hint: (p, v) => {
      if (!v.gia_ban || !v.gia_nhan) return 'Ghi thành 1 lần bán + 1 lần mua; tiền thay đổi đúng bằng phần bù.';
      const diff = v.gia_ban - v.gia_nhan;
      return diff >= 0 ? `Khách bù ${formatShort(diff)}.` : `Mình bù khách ${formatShort(-diff)}.`;
    }
  },
  ha_gia: {
    title: 'Đổi giá kỳ vọng', icon: '🏷️', submit: 'Lưu giá mới',
    fields: [
      { name: 'ma_may', label: 'Máy', type: 'machine', required: true, source: stockPicks },
      { name: 'gia_ky_vong', label: 'Giá kỳ vọng mới', type: 'money', required: true },
      { name: 'gia_san', label: 'Giá sàn mới (trống = giữ)', type: 'money' }
    ],
    hint: (p, v) => {
      const item = findStock(p, v.ma_may);
      if (!item) return '';
      const parts = [`Đang ${formatShort(item.gia_ky_vong)} · ${item.days} ngày · giữ thêm 7 ngày tốn ~${formatShort(item.extraPer7)}.`];
      if (item.suggestedPrice) parts.push(`Gợi ý: ${formatShort(item.suggestedPrice)}.`);
      return parts.join(' ');
    }
  },
  bao_hanh: {
    title: 'Bảo hành sau bán', icon: '🛡️', submit: 'Lưu bảo hành',
    fields: [
      { name: 'ma_may', label: 'Máy đã bán', type: 'machine', required: true, source: soldPicks },
      { name: 'so_tien', label: 'Chi phí', type: 'money', unit: 'k', required: true },
      noteField, dateField
    ],
    hint: () => 'Trừ vào lãi của chính máy đó.'
  },
  thu_chi: {
    title: 'Thu / chi khác', icon: '🧾', submit: 'Lưu',
    fields: [
      { name: 'loai', label: 'Loại', type: 'choice', required: true, options: (p) => p.lists.otherFlowTypes },
      { name: 'so_tien', label: 'Số tiền', type: 'money', required: true },
      { name: 'ghi_chu', label: 'Ghi chú', type: 'text' },
      dateField
    ],
    hint: (p, v) => (v.loai === 'Rút cá nhân'
      ? 'Rút tiền tiêu cá nhân phải ghi ở đây, nếu không số tiền sẽ lệch khi đối chiếu.'
      : 'Chi cố định: mặt bằng, điện, phí ship hàng chung… Góp vốn / Vay: tiền đưa thêm vào kinh doanh.')
  }
};
