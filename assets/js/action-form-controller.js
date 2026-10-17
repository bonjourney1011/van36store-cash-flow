// Turns a declarative spec into a one-thumb form: choices as buttons, machines as a pick list,
// money typed on the number pad in the field's unit (tr or k) with a live preview.
// Only visible fields are sent; a field may be sent under another name (sendAs).
import { el, formatVnd, todayIso } from './dom-and-format-helpers.js';
import { parseMoney } from './money-input-parser.js';

const isRequired = (spec, values) => (typeof spec.required === 'function' ? spec.required(values) : Boolean(spec.required));
const isVisible = (spec, values) => !spec.showIf || Boolean(spec.showIf(values));

function labelFor(spec, values) {
  return el('span', { class: 'field__label' }, spec.label, isRequired(spec, values) ? el('em', { text: ' *' }) : null);
}

function buildInput(f, ctx) {
  const { spec } = f;
  const { values, changed } = ctx;
  if (spec.type === 'choice') {
    const group = el('div', { class: 'segmented', role: 'group' });
    f.body = group;
    f.refresh = () => {
      const options = spec.options(ctx.payload, values) || [];
      group.replaceChildren(...(options.length ? options.map((option) => el('button', {
        type: 'button', 'aria-pressed': String(values[spec.name] === option), text: option,
        onclick: () => { values[spec.name] = values[spec.name] === option && !isRequired(spec, values) ? undefined : option; changed(true); }
      })) : [el('p', { class: 'pick-empty', text: 'Chưa có lựa chọn nào.' })]));
    };
  } else if (spec.type === 'machine' || spec.type === 'machines') {
    const multi = spec.type === 'machines';
    const list = el('div', { class: 'pick-list' });
    f.body = list;
    f.refresh = () => {
      const items = spec.source(ctx.payload, values);
      if (multi) values[spec.name] = (values[spec.name] || []).filter((code) => items.some((i) => i.code === code));
      const selected = (code) => (multi ? values[spec.name].includes(code) : values[spec.name] === code);
      list.replaceChildren(...(items.length ? items.map((item) => el('button', {
        type: 'button', class: 'pick', 'aria-pressed': String(selected(item.code)),
        onclick: () => {
          if (multi) values[spec.name] = selected(item.code) ? values[spec.name].filter((c) => c !== item.code) : [...values[spec.name], item.code];
          else values[spec.name] = item.code;
          changed(true);
        }
      }, el('b', { text: item.title }), el('small', { text: item.sub }))) : [el('p', { class: 'pick-empty', text: 'Không có máy phù hợp.' })]));
    };
  } else if (spec.type === 'toggle') {
    const box = el('input', { type: 'checkbox', onchange: () => { values[spec.name] = box.checked; changed(true); } });
    box.checked = values[spec.name] === true;
    f.body = el('label', { class: 'toggle' }, box, spec.label);
    f.clear = () => { box.checked = false; };
  } else {
    const isMoney = spec.type === 'money';
    const input = el('input', {
      type: spec.type === 'date' ? 'date' : 'text', inputmode: isMoney ? 'decimal' : null,
      placeholder: spec.placeholder || (isMoney ? (spec.unit === 'k' ? 'Số nghìn, VD 300 = 300k' : 'Số triệu, VD 12,5 = 12,5tr') : null),
      max: spec.type === 'date' ? todayIso() : null,
      autocomplete: 'off', list: spec.suggestions ? `dl-${spec.name}` : null
    });
    const preview = isMoney ? el('p', { class: 'field__preview' }) : null;
    const prefill = values[spec.name];
    if (prefill != null) input.value = isMoney ? String(prefill) : prefill;
    const read = () => {
      if (!isMoney) { values[spec.name] = input.value.trim() || undefined; return; }
      const amount = parseMoney(input.value, spec.unit);
      values[spec.name] = amount ?? undefined;
      preview.textContent = input.value.trim() ? (amount == null ? 'Không đọc được số, VD 12tr5 hoặc 800k' : `= ${formatVnd(amount)}`) : '';
    };
    input.addEventListener('input', () => { read(); changed(false); });
    if (prefill != null) read();
    const datalist = spec.suggestions ? el('datalist', { id: `dl-${spec.name}` }, (spec.suggestions(ctx.payload) || []).map((v) => el('option', { value: v }))) : null;
    f.body = el('div', {}, input, preview, datalist);
    f.clear = () => { input.value = ''; if (preview) preview.textContent = ''; };
  }
  if (spec.hint) f.body = el('div', {}, f.body, el('p', { class: 'field__preview', text: spec.hint }));
}

export function openActionForm(container, action, spec, payload, prefill, { onSubmit, onClose }) {
  const values = { ...prefill };
  // Same id for every retry of this form; the form is rebuilt after a successful save.
  const requestId = crypto.randomUUID();
  const fields = spec.fields.map((fieldSpec) => ({ spec: fieldSpec }));
  const hint = el('p', { class: 'form-hint' });
  const error = el('p', { class: 'form-error', role: 'alert' });
  const ctx = { payload, values, changed: () => {} };

  const sync = (structural) => {
    if (structural) {
      for (const f of fields) {
        const show = isVisible(f.spec, values);
        if (!show && f.visible) {
          delete values[f.spec.name];
          f.clear?.();
        }
        f.visible = show;
        f.wrap.hidden = !show;
        f.wrap.querySelector('.field__label')?.replaceWith(labelFor(f.spec, values));
        f.refresh?.();
      }
    }
    hint.textContent = spec.hint ? spec.hint(payload, values) || '' : '';
    error.textContent = '';
  };
  ctx.changed = sync;

  const main = el('div');
  const more = el('details', { class: 'more' }, el('summary', { text: 'Thêm chi tiết' }));
  for (const f of fields) {
    buildInput(f, ctx);
    f.wrap = el('div', { class: 'field' }, f.spec.type === 'toggle' ? null : labelFor(f.spec, values), f.body);
    (f.spec.more ? more : main).append(f.wrap);
    if (f.spec.more && values[f.spec.name] != null) more.open = true;
  }

  const submit = el('button', { class: 'btn', type: 'submit', text: spec.submit });
  const form = el('form', { class: 'card form-panel', novalidate: true },
    el('div', { class: 'form-panel__head' },
      el('h2', { class: 'form-panel__title', text: `${spec.icon} ${spec.title}` }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', text: '✕', onclick: onClose })),
    main, fields.some((f) => f.spec.more) ? more : null, hint, error, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = {};
    for (const f of fields.filter((item) => item.visible)) {
      const value = values[f.spec.name];
      const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
      if (empty && isRequired(f.spec, values)) { error.textContent = `Thiếu "${f.spec.label}".`; return; }
      if (!empty) data[f.spec.sendAs || f.spec.name] = value;
    }
    submit.disabled = true;
    submit.textContent = 'Đang lưu…';
    const result = await onSubmit(action, data, requestId);
    submit.disabled = false;
    submit.textContent = spec.submit;
    if (!result.ok) error.textContent = result.error;
  });

  container.replaceChildren(form);
  sync(true);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
