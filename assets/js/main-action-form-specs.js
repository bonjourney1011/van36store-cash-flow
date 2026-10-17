// Declarative forms for the 5 everyday actions. Required fields stay ≤ 4; the rest hide under "Thêm chi tiết".
// Field types: choice, text, money, date, toggle, machine (pick one), machines (tick many).
import { formatShort, formatPct } from './dom-and-format-helpers.js';
import { stockPicks, pendingPicks, creditDealers, findStock, newMachineFields, dateField, noteField } from './action-form-pickers.js';
import { MORE_ACTION_SPECS } from './action-form-specs-more.js';

const isDealer = (v) => v.kenh_ban === 'Mối';
const partnerOf = (v) => (v.nguon === 'Mối' ? v.doi_tac_moi : v.doi_tac_cod);

export const ACTION_SPECS = {
  ...MORE_ACTION_SPECS,
  dau_ky: {
    title: 'Kiểm kê đầu kỳ', icon: '🧮', submit: 'Lưu số dư đầu kỳ',
    fields: [
      { name: 'tien_mat', label: 'Tiền mặt đếm được', type: 'money', required: true },
      { name: 'so_du_tk', label: 'Số dư tài khoản kinh doanh', type: 'money', required: true },
      { name: 'no_vay', label: 'Nợ vay đang có (nếu có)', type: 'money', more: true },
      dateField
    ],
    hint: () => 'Chỉ làm 1 lần. Sau đó thêm từng máy đang có bằng "Mua máy" → mở "Thêm chi tiết" → tick "Máy có sẵn".'
  },
  mua: {
    title: 'Mua máy', icon: '📥', submit: 'Lưu máy mua',
    fields: [...newMachineFields('gia_mua', 'Giá mua'),
      { name: 'co_san', label: 'Máy có sẵn từ trước (kiểm kê đầu kỳ, không trừ tiền)', type: 'toggle', more: true },
      dateField, noteField],
    hint: (p, v) => {
      const max = p.dashboard.kpis.maxBuyToday;
      if (v.gia_mua > max && !v.co_san) return `⚠️ Vượt mức nên mua hôm nay (${formatShort(max)}): sau khi mua, tiền sẽ dưới mức đệm hoặc 1 máy chiếm quá nhiều vốn.`;
      return `Hôm nay mua tối đa ${formatShort(max)}.`;
    }
  },
  ban: {
    title: 'Bán / gửi máy', icon: '📤', submit: 'Lưu bán',
    fields: [
      { name: 'kenh_ban', label: 'Bán qua', type: 'choice', required: true, options: () => ['Tại chỗ', 'COD', 'Mối'] },
      { name: 'ma_may', label: 'Máy', type: 'machine', required: true, source: stockPicks },
      { name: 'gia_ban', label: 'Giá bán', type: 'money', required: true },
      { name: 'doi_tac_cod', sendAs: 'doi_tac', label: 'Hãng vận chuyển', type: 'choice', required: true, options: (p) => p.lists.carriers, showIf: (v) => v.kenh_ban === 'COD' },
      { name: 'tien_coc', label: 'Khách cọc trước', type: 'money', unit: 'k', showIf: (v) => v.kenh_ban === 'COD' },
      { name: 'ma_van_don', label: 'Mã vận đơn', type: 'text', more: true, showIf: (v) => v.kenh_ban === 'COD' },
      { name: 'doi_tac_moi', sendAs: 'doi_tac', label: 'Tên mối', type: 'text', required: true, suggestions: (p) => p.lists.dealers, showIf: isDealer },
      { name: 'tra_ngay', label: 'Mối trả đủ ngay', type: 'toggle', showIf: isDealer },
      { name: 'da_tra', label: 'Mối trả trước một phần', type: 'money', showIf: (v) => isDealer(v) && !v.tra_ngay },
      { name: 'han_tra', label: 'Hạn trả (trống = theo Config)', type: 'date', showIf: (v) => isDealer(v) && !v.tra_ngay },
      dateField
    ],
    hint: (p, v) => {
      const item = findStock(p, v.ma_may);
      if (!item || !v.gia_ban) return '';
      const profit = v.gia_ban - item.cost;
      return `Vốn ${formatShort(item.cost)} → ${profit >= 0 ? 'lãi' : 'lỗ'} ${formatShort(Math.abs(profit))} (${formatPct(profit / item.cost)}) sau ${item.days} ngày giữ.`;
    }
  },
  tien_ve: {
    title: 'Tiền về', icon: '💰', submit: 'Lưu tiền về',
    fields: [
      { name: 'nguon', label: 'Tiền từ', type: 'choice', required: true, options: () => ['COD', 'Mối'] },
      { name: 'doi_tac_cod', sendAs: 'doi_tac', label: 'Hãng (lọc đơn)', type: 'choice', options: (p) => p.lists.carriers, showIf: (v) => v.nguon === 'COD' },
      { name: 'doi_tac_moi', sendAs: 'doi_tac', label: 'Mối', type: 'choice', required: true, options: creditDealers, showIf: (v) => v.nguon === 'Mối' },
      { name: 'ma_may_list', label: 'Tick các đơn vừa trả', type: 'machines', required: (v) => v.nguon === 'COD',
        source: (p, v) => pendingPicks(p, v.nguon === 'Mối' ? 'Nợ mối' : 'Đang gửi', partnerOf(v)), showIf: (v) => v.nguon },
      { name: 'tong_nhan', label: 'Tổng tiền thực nhận', type: 'money', required: true },
      { name: 'phi_hoan_tru', label: 'Phí hoàn hãng trừ trong lần này (nếu có)', type: 'money', unit: 'k', more: true, showIf: (v) => v.nguon === 'COD',
        hint: 'Xem trên bảng đối soát của hãng. Ghi ở đây để tiền khớp sổ.' },
      dateField
    ],
    hint: (p, v) => {
      const picks = pendingPicks(p, v.nguon === 'Mối' ? 'Nợ mối' : 'Đang gửi', partnerOf(v)).filter((i) => (v.ma_may_list || []).includes(i.code));
      const expected = picks.reduce((sum, i) => sum + i.amount, 0);
      if (!expected) return v.nguon === 'Mối' ? 'Không tick máy nào = trừ vào nợ cũ nhất của mối.' : '';
      if (v.nguon === 'Mối' || !v.tong_nhan) return `Các đơn đã tick đang chờ ${formatShort(expected)}.`;
      const fee = expected - v.tong_nhan - (v.phi_hoan_tru || 0);
      return `Thu hộ ${formatShort(expected)} → nhận ${formatShort(v.tong_nhan)} → phí ship/COD ${formatShort(fee)} (${formatPct(fee / expected, 1)}).`;
    }
  },
  doi_chieu: {
    title: 'Đối chiếu số dư', icon: '⚖️', submit: 'Lưu đối chiếu',
    fields: [
      { name: 'tien_mat', label: 'Tiền mặt đếm được', type: 'money', required: true },
      { name: 'so_du_tk', label: 'Số dư tài khoản', type: 'money', required: true },
      { name: 'ly_do', label: 'Nếu lệch, vì sao?', type: 'choice', options: () => ['Tiêu cá nhân', 'Không rõ'],
        hint: 'Lệch vì quên nhập một khoản? Nhập khoản đó trước rồi đối chiếu lại, đừng ghi ở đây.' },
      noteField
    ],
    hint: (p, v) => {
      const book = p.dashboard.buckets.cash;
      if (v.tien_mat == null || v.so_du_tk == null) return `Sổ đang ghi: ${formatShort(book)}.`;
      const diff = v.tien_mat + v.so_du_tk - book;
      return diff ? `Sổ ghi ${formatShort(book)} → lệch ${diff > 0 ? '+' : ''}${formatShort(diff)}.` : 'Khớp sổ 👍';
    }
  }
};
