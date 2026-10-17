/**
 * Pure text/number/date helpers shared by the other .gs files (no Google services, tested in Node).
 * Dates are local calendar days in the script time zone (Asia/Ho_Chi_Minh).
 */
var DAY_MS = 86400000;

function cleanText(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Blocks formula injection: Sheets would evaluate text starting with = + - @. */
function sanitizeCell(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value && typeof value.getTime === 'function') return value;
  var text = String(value == null ? '' : value);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function pad(number, width) {
  var text = String(number);
  while (text.length < width) text = '0' + text;
  return text;
}

/** 12500000 -> "12.500.000"; avoids Intl, whose locale support in Apps Script is patchy. */
function formatVnd(amount) {
  var rounded = Math.round(Number(amount) || 0);
  var sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 12500000 -> "12,5tr", 800000 -> "800k": how the owner talks about prices. */
function formatShortVnd(amount) {
  var value = Math.round(Number(amount) || 0);
  var sign = value < 0 ? '-' : '';
  var abs = Math.abs(value);
  if (abs >= 1000000) return sign + String(Math.round(abs / 100000) / 10).replace('.', ',') + 'tr';
  if (abs >= 1000) return sign + Math.round(abs / 1000) + 'k';
  return sign + abs + 'đ';
}

function formatPercent(ratio) {
  return Math.round((Number(ratio) || 0) * 100) + '%';
}

/** "Khác" -> "khac", "iPhone" -> "iphone": used to build Config keys per machine group. */
function slugify(text) {
  return String(text == null ? '' : text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function toNumberOrZero(value) {
  var number = Number(value);
  return value === '' || value == null || isNaN(number) ? 0 : number;
}

function isValidDate(value) {
  return Boolean(value) && typeof value.getTime === 'function' && !isNaN(value.getTime());
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  var result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Whole calendar days from a to b (b later = positive). Rounding absorbs DST-free offsets. */
function daysBetween(a, b) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/** "2026-10-18" (from <input type=date>) -> local Date, or null. */
function parseIsoDate(text) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || '').trim());
  if (!match) return null;
  var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 ? date : null;
}

function formatIsoDate(date) {
  if (!isValidDate(date)) return '';
  return date.getFullYear() + '-' + pad(date.getMonth() + 1, 2) + '-' + pad(date.getDate(), 2);
}

function formatDayMonth(date) {
  if (!isValidDate(date)) return '';
  return pad(date.getDate(), 2) + '/' + pad(date.getMonth() + 1, 2);
}
