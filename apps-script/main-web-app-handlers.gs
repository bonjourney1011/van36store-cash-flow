/**
 * Web app entry points. Deploy: Execute as "Me", Who has access "Anyone" (the token guards the data).
 * Every path returns JSON; an uncaught error would come back as an HTML page,
 * which the browser reports as a CORS failure.
 */
var REQUEST_REPLAY_SECONDS = 21600;
var BUSY_MESSAGE = 'Hệ thống đang bận, thử lại sau ít phút nhé.';

/** No data on GET: opening the /exec URL in a browser only confirms the deployment works. */
function doGet() {
  return respondJson_(function () {
    return { ok: true, service: 'dong-tien-may-cu' };
  });
}

/** Body (text/plain JSON): { t: token, action: 'dashboard' | <planner name>, data: {...}, requestId } */
function doPost(e) {
  return respondJson_(function () {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'Dữ liệu không hợp lệ.' };
    var auth = checkAccessToken_(payload.t);
    if (!auth.ok) return auth;

    var action = cleanText(payload.action, 20);
    if (action === 'dashboard') return buildDashboardPayload(readState(), startOfDay(new Date()));
    return runAction_(action, payload);
  });
}

function runAction_(action, payload) {
  // One id per filled form: a retry after a timeout gets the first answer back instead of a duplicate.
  var requestId = typeof payload.requestId === 'string' ? payload.requestId.replace(/[^\w-]/g, '').slice(0, 64) : '';
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: BUSY_MESSAGE };
  try {
    var replay = requestId && cache.get('req_' + requestId);
    if (replay) return JSON.parse(replay);

    var state = readState();
    var now = new Date();
    var today = startOfDay(now);
    var createsMachine = ACTIONS_CREATING_MACHINE.indexOf(action) !== -1;
    var ctx = {
      machines: state.machines, ledger: state.ledger, config: state.config,
      today: today, now: now, newCode: createsMachine ? peekNextMachineCode(state.machines) : ''
    };
    var result = planAction(action, payload.data, ctx);
    if (!result.ok) return result;

    applyPlan(result.plan, state.machines, now);
    if (createsMachine) commitMachineCode(ctx.newCode);
    SpreadsheetApp.flush();
    // The full dashboard is too big for the cache; a replayed request just tells the page to reload.
    if (requestId) cache.put('req_' + requestId, JSON.stringify({ ok: true, message: result.message, replayed: true }), REQUEST_REPLAY_SECONDS);

    var response = buildDashboardPayload(readState(), today);
    response.message = result.message;
    return response;
  } finally {
    lock.releaseLock();
  }
}

function respondJson_(handler) {
  var body;
  try {
    body = handler();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    body = { ok: false, error: BUSY_MESSAGE };
  }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
