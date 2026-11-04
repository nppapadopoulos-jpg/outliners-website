// The public entry points remain closed even when synthetic tests exercise core logic.
export function liveFormsEnabled(env) {
  return env.ENABLE_LIVE_FORMS === 'true' && env.LIVE_FORMS_APPROVAL === 'owner-approved-go-live';
}
export function createPublicFormsEndpoint(env, makeHandler) {
  // No storage/email construction or request body parsing while submissions are closed.
  const handle = liveFormsEnabled(env) ? makeHandler() : null;
  return async (name, request, context) => handle
    ? handle(name, request, context)
    : new Response(JSON.stringify({ ok: false, code: 'forms-not-live' }), {
        status: 503, headers: { 'cache-control': 'no-store', 'content-type': 'application/json', 'x-content-type-options': 'nosniff' },
      });
}
