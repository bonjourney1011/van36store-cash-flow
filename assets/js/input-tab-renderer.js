// "Nhập" tab: 4 big everyday actions, 6 smaller ones, and the form host below them.
import { el } from './dom-and-format-helpers.js';
import { ACTION_SPECS } from './main-action-form-specs.js';

const MAIN_ACTIONS = ['mua', 'ban', 'tien_ve', 'doi_chieu'];
const MORE_ACTIONS = ['chi_sua', 'hoan', 'doi_may', 'ha_gia', 'bao_hanh', 'thu_chi'];

function tile(action, openAction, primary) {
  const spec = ACTION_SPECS[action];
  return el('button', {
    type: 'button', class: `action-tile${primary ? ' action-tile--primary' : ''}`,
    onclick: () => openAction(action, {})
  }, el('span', { 'aria-hidden': 'true', text: spec.icon }), spec.title);
}

const COUNTING_DAYS = 14;
const dayNumber = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;

/**
 * Stock-count window: the opening row is still among the latest entries and at most 14 days old.
 * Afterwards the tile hides; "Mua máy" → "Thêm chi tiết" → "Máy có sẵn" stays as the fallback.
 */
function isCountingStock(payload) {
  const opening = payload.recentLedger.find((row) => row.loai === 'Đầu kỳ');
  return Boolean(opening) && dayNumber(payload.dashboard.today) - dayNumber(opening.ngay) <= COUNTING_DAYS;
}

const fullWidth = (action, openAction) =>
  el('div', { class: 'actions-main', style: 'grid-template-columns:1fr' }, tile(action, openAction, true));

/** Returns the element forms are rendered into. */
export function renderInputTab(container, payload, openAction) {
  const formHost = el('div');
  const needsOpening = !payload.dashboard.hasOpening;
  const blocks = [
    needsOpening ? fullWidth('dau_ky', openAction) : null,
    !needsOpening && isCountingStock(payload) ? fullWidth('mua_co_san', openAction) : null,
    el('div', { class: 'actions-main' }, MAIN_ACTIONS.map((action) => tile(action, openAction, false))),
    el('div', { class: 'actions-more' }, MORE_ACTIONS.map((action) => tile(action, openAction, false))),
    el('p', { class: 'card__hint', text: 'Chỉ nhập khi tiền hoặc máy đổi chỗ. Ngày tự là hôm nay; nhập bù thì mở "Thêm chi tiết".' }),
    formHost
  ];
  container.replaceChildren(...blocks.filter(Boolean));
  return formHost;
}

export const specFor = (action) => ACTION_SPECS[action];
