// Entry point: token gate, tab switching, load/refresh, and the submit → re-render loop.
import { el } from './dom-and-format-helpers.js';
import { isApiConfigured, captureToken, forgetToken, setToken, callApi } from './api-client-with-token.js';
import { renderOverview } from './overview-renderers.js';
import { renderLists } from './machine-and-order-lists.js';
import { renderInputTab, specFor } from './input-tab-renderer.js';
import { openActionForm } from './action-form-controller.js';

const views = {
  overview: document.getElementById('view-overview'),
  input: document.getElementById('view-input'),
  lists: document.getElementById('view-lists')
};
const gate = document.getElementById('gate');
const tabbar = document.getElementById('tabbar');
const dateLabel = document.getElementById('today-label');
let payload = null;
let formHost = null;
let toastTimer = null;

function showGate(title, text) {
  gate.replaceChildren(el('h2', { text: title }), el('p', { class: 'muted', text }));
  gate.hidden = false;
  tabbar.hidden = true;
  Object.values(views).forEach((view) => { view.hidden = true; });
}

function toast(message, isError) {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.className = `toast${isError ? ' toast--error' : ''}`;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, isError ? 6000 : 4000);
}

function selectTab(name) {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  tabbar.querySelectorAll('button').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === name)));
  window.scrollTo({ top: 0 });
}

function openAction(action, prefill) {
  selectTab('input');
  const spec = specFor(action);
  openActionForm(formHost, action, spec, payload, prefill, {
    onSubmit: async (serverAction, data, requestId) => {
      const result = await submitAction(serverAction, data, requestId);
      if (result.ok && spec.repeatWith) {
        openAction(action, Object.fromEntries(spec.repeatWith.filter((key) => data[key] != null).map((key) => [key, data[key]])));
      }
      return result;
    },
    onClose: () => formHost.replaceChildren()
  });
}

function renderAll() {
  gate.hidden = true;
  tabbar.hidden = false;
  const [y, m, d] = payload.dashboard.today.split('-');
  dateLabel.textContent = `${d}/${m}/${y}`;
  renderOverview(views.overview, payload);
  renderLists(views.lists, payload, openAction);
  formHost = renderInputTab(views.input, payload, openAction);
}

function handleFailure(result) {
  if (result.unauthorized) {
    forgetToken();
    showGate('Cần link riêng', result.error);
    return true;
  }
  return false;
}

async function load() {
  const result = await callApi('dashboard');
  if (!result.ok) {
    if (!handleFailure(result)) {
      if (payload) toast(result.error, true);
      else showGate('Chưa tải được', result.error);
    }
    return;
  }
  payload = result;
  const current = Object.keys(views).find((key) => !views[key].hidden) || 'overview';
  renderAll();
  selectTab(current);
}

async function submitAction(action, data, requestId) {
  const result = await callApi(action, data, requestId);
  if (!result.ok) {
    handleFailure(result);
    return result;
  }
  toast(result.message || 'Đã lưu.');
  if (result.dashboard) {
    payload = result;
    renderAll();
    selectTab('input');
  } else {
    await load();
  }
  return result;
}

function init() {
  tabbar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (button) selectTab(button.dataset.tab);
  });
  document.getElementById('refresh').addEventListener('click', () => { toast('Đang tải lại…'); load(); });
  if (!isApiConfigured()) {
    showGate('Chưa kết nối Google Sheet', 'Điền apiUrl trong assets/js/site-config.js (xem README, bước 2).');
    return;
  }
  const token = captureToken();
  if (!token) {
    showGate('Cần link riêng', 'Mở trang bằng link riêng (có #t=…) được gửi qua tin nhắn. Mở 1 lần là điện thoại tự nhớ.');
    return;
  }
  setToken(token);
  views.overview.replaceChildren(el('p', { class: 'loading', text: 'Đang tải số liệu…' }));
  views.overview.hidden = false;
  load();
}

init();
