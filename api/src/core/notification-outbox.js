import { randomUUID } from 'node:crypto';
const INTERVAL = 10 * 60 * 1000;
const TERMINAL = new Set(['succeeded','failed','uncertain','expired']);
const defer = (state, now, delay = 0) => { state.nextAt = now + Math.max(INTERVAL, delay, Math.min(24*3600000, INTERVAL * 2 ** Math.min(state.attempts || 0, 7))); };
// One durable, globally leased action per ten minutes: <=6 send/status calls/hour.
// Uncertain sends are NEVER restarted with a fresh identity after ACS's 5min window.
export async function runNotificationCycle({ repository, transport, env, now = Date.now() }) {
  if (env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') return { outcome: 'disabled' };
  return repository.exclusive(async control => {
    const month = new Date(now).toISOString().slice(0,7);
    if (control.month !== month) Object.assign(control, { month, sends: 0 });
    if (now < (control.nextActionAt || 0)) return { outcome: 'rate-wait' };
    const states = await repository.discover(now);
    const state = states.filter(s => !TERMINAL.has(s.status) && (s.nextAt || 0) <= now).sort((a,b) => (a.nextAt || 0)-(b.nextAt || 0))[0];
    if (!state) return { outcome: 'idle' };
    if (Date.parse(state.deleteAfter) <= now) { state.status = 'expired'; await repository.save(state); return { outcome: 'expired' }; }
    if (state.polls >= 144) { state.status = 'uncertain'; await repository.save(state); return { outcome: 'uncertain' }; }
    const isNew = state.status === 'pending';
    if (isNew && control.sends >= 500) return { outcome: 'monthly-budget-stop' };
    control.nextActionAt = now + INTERVAL;
    if (isNew) {
      state.status = 'prepared'; state.operationId = randomUUID(); state.firstSent = now; state.attempts = (state.attempts || 0)+1;
      control.sends++;
    }
    // Both markers are durable before any external side effect. A crash can
    // consume budget without sending, but cannot bypass the cap or lose op ID.
    await repository.saveControl(control);
    await repository.save(state);
    await repository.assertLock();
    let result;
    try { result = isNew ? await transport.submit(state) : await transport.status(state); }
    catch { result = { http: 0 }; }
    if (!isNew) state.polls = (state.polls || 0)+1;
    if (result.status === 'Succeeded') state.status = 'succeeded'; // ACS completion, not mailbox proof.
    else if (result.status === 'Failed' || result.status === 'Canceled') state.status = 'failed';
    else if ([200,202].includes(result.http)) { state.status = 'submitted'; defer(state, now, result.retryAfterMs); }
    else if (isNew && result.http === 429) {
      state.status = state.attempts >= 6 ? 'failed' : 'pending';
      delete state.operationId; delete state.firstSent;
      defer(state, now, result.retryAfterMs);
    } else if (isNew && [400,401,403,413,422].includes(result.http)) { state.status = 'failed'; }
    else if (!isNew && result.http === 404) {
      // Missing operation after the safety window is ambiguous, not permission
      // to send a new message. Stop for manual reconciliation.
      state.status = 'uncertain';
    } else { defer(state, now, result.retryAfterMs); }
    // A 409/412, timeout or 5xx retains operationId and only polls on restart.
    // This deliberately favours no duplicate over automatic ambiguous resends.
    state.lastHttp = result.http; state.updatedAt = new Date(now).toISOString();
    await repository.save(state);
    return { outcome: state.status };
  });
}
