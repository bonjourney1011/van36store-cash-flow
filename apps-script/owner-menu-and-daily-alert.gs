/**
 * "Dòng tiền" menu in the Sheet (desktop) + the 8:00 daily routine:
 * write today's snapshot (for the trend chart) and email a digest when something needs attention.
 * Emails go to the deploying Google account; set Script Property NOTIFY_EMAIL to send elsewhere.
 */
var DAILY_HANDLER = 'runDailyRoutine';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Dòng tiền')
    .addItem('🔑 Tạo link mới cho anh (link cũ hết hiệu lực)', 'createOwnerLink')
    .addItem('⏰ Bật nhắc 8h sáng hằng ngày', 'installDailyTrigger')
    .addItem('📨 Chạy kiểm tra + gửi email ngay', 'runDailyRoutineWithToast')
    .addToUi();
}

function createOwnerLink() {
  var token = rotateAccessToken_();
  var siteUrl = String(readConfig().site_url || '').trim();
  var link = siteUrl ? siteUrl.replace(/#.*$/, '') + '#t=' + token : '(Chưa điền site_url trong Config) token: ' + token;
  var html = HtmlService.createHtmlOutput(
    '<p style="font:14px sans-serif">Gửi link này cho anh qua tin nhắn riêng. Mở 1 lần là trang tự nhớ.</p>' +
    '<textarea readonly style="width:100%;height:90px;font:13px monospace" onclick="this.select()">' +
    escapeHtml_(link) + '</textarea>'
  ).setWidth(460).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Link riêng cho anh');
}

function escapeHtml_(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === DAILY_HANDLER) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(DAILY_HANDLER).timeBased().everyDays(1).atHour(8).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Đã bật: mỗi sáng 8h ghi số liệu và gửi email nếu có việc cần làm.', 'Dòng tiền', 6);
}

function runDailyRoutineWithToast() {
  var sent = runDailyRoutine();
  SpreadsheetApp.getActiveSpreadsheet().toast(sent ? 'Đã ghi snapshot và gửi email.' : 'Đã ghi snapshot. Không có cảnh báo nên không gửi email.', 'Dòng tiền', 6);
}

/** Returns true when an email went out. Never throws from the trigger without logging. */
function runDailyRoutine() {
  var today = startOfDay(new Date());
  var state = readState();
  var dash = computeDashboard(state.machines, state.ledger, state.snapshots, state.config, today);
  writeSnapshot(today, dash.buckets);
  var recs = buildRecommendations(dash, state.config).filter(function (rec) { return rec.level !== 'xanh'; });
  if (!recs.length) return false;
  try {
    var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
    if (!to) return false;
    MailApp.sendEmail({ to: to, subject: buildDigestSubject(dash, recs), body: buildDigestText(dash, recs, state.config) });
    return true;
  } catch (err) {
    console.error('Daily email failed', err);
    return false;
  }
}

function buildDigestSubject(dash, recs) {
  var urgent = recs.filter(function (rec) { return rec.level === 'do'; }).length;
  return '💰 Dòng tiền ' + formatDayMonth(startOfDay(new Date())) + ': ' +
    (urgent ? urgent + ' việc cần làm ngay' : recs.length + ' điều cần để ý') +
    ' · tiền ' + formatShortVnd(dash.buckets.cash);
}

/** Plain text on purpose: no token in the email, the page remembers it on the owner's phone. */
function buildDigestText(dash, recs, config) {
  var b = dash.buckets;
  var lines = [
    'Tiền: ' + formatShortVnd(b.cash) + ' · Chờ thu: ' + formatShortVnd(b.receivable) +
      ' · Máy tồn (giá vốn): ' + formatShortVnd(b.stock) + ' · Vốn chủ: ' + formatShortVnd(b.equity),
    'Hôm nay mua được tối đa: ' + formatShortVnd(dash.kpis.maxBuyToday),
    ''
  ];
  recs.forEach(function (rec, index) {
    lines.push((index + 1) + '. ' + (rec.level === 'do' ? '[LÀM NGAY] ' : '') + rec.title);
    lines.push('   ' + rec.detail);
  });
  if (config.site_url) lines.push('', 'Mở trang: ' + String(config.site_url).replace(/#.*$/, ''));
  return lines.join('\n');
}
