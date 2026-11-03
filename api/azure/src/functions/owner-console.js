import { app } from '@azure/functions';
import { readFile } from 'node:fs/promises';
import { createOwnerAuthenticator } from '../../../src/core/owner-auth.js';

const authenticate = createOwnerAuthenticator(process.env);
const root = new URL('../../owner-console/', import.meta.url);
const vendor = new URL('../../../node_modules/@azure/msal-browser/lib/', import.meta.url);
const headers = {
  'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex, nofollow',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https://login.microsoftonline.com; frame-src https://login.microsoftonline.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
};
const enabled = () => process.env.ENABLE_OWNER_DOWNLOAD === 'true';
app.http('ownerConsole', {
  methods: ['GET'], authLevel: 'anonymous', route: 'owner/console',
  handler: async () => ({ status: enabled() ? 200 : 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' }, body: enabled() ? await readFile(new URL('index.html', root), 'utf8') : 'Owner access unavailable' }),
});
app.http('ownerCallback', {
  methods: ['GET'], authLevel: 'anonymous', route: 'owner/callback',
  handler: async () => ({ status: 200, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' }, body: await readFile(new URL('callback.html', root), 'utf8') }),
});
const assets = new Map([
  ['console.js', [new URL('console.js', root), 'text/javascript']],
  ['console.css', [new URL('console.css', root), 'text/css']],
  ['callback.js', [new URL('callback.js', root), 'text/javascript']],
  ['msal.js', [new URL('msal-browser.min.js', vendor), 'text/javascript']],
  ['bridge.js', [new URL('redirect-bridge/msal-redirect-bridge.min.js', vendor), 'text/javascript']],
]);
app.http('ownerAssets', {
  methods: ['GET'], authLevel: 'anonymous', route: 'owner/assets/{name}',
  handler: async request => {
    const asset = assets.get(request.params.name);
    if (!asset) return { status: 404, headers };
    return { status: 200, headers: { ...headers, 'content-type': `${asset[1]}; charset=utf-8` }, body: await readFile(asset[0], 'utf8') };
  },
});
app.http('ownerConfig', {
  methods: ['GET'], authLevel: 'anonymous', route: 'owner/config',
  handler: async () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const values = [process.env.OWNER_TENANT_ID, process.env.OWNER_CLIENT_ID, process.env.OWNER_TOKEN_AUDIENCE];
    if (!enabled() || !values.every(v => uuid.test(v || ''))) return { status: 503, headers };
    // Public OAuth identifiers only. No owner ID, token, secret or storage URL.
    return { status: 200, headers, jsonBody: { tenantId: values[0], clientId: values[1], audience: values[2] } };
  },
});
app.http('ownerSession', {
  methods: ['GET'], authLevel: 'anonymous', route: 'owner/session',
  handler: async request => {
    if (!enabled()) return { status: 503, headers };
    if (!await authenticate(request)) return { status: 401, headers: { ...headers, 'www-authenticate': 'Bearer' } };
    // Booleans attest successful server-side JWT verification. Never echo claims.
    return { status: 200, headers, jsonBody: { owner: true, mfa: true } };
  },
});
