// Cryptographic validation, independent of caller-controlled platform headers.
// Browser clients obtain a delegated token through MSAL/PKCE; never put tokens
// in links. An Entra app registration and MFA configuration are deployment gates.
export function createOwnerAuthenticator(env, { verify, keys } = {}) {
  const tenant = env.OWNER_TENANT_ID;
  const owner = env.OWNER_OBJECT_ID;
  const audience = env.OWNER_TOKEN_AUDIENCE;
  const client = env.OWNER_CLIENT_ID;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let remoteKeys;
  return async function authenticate(request) {
    if (!uuid.test(tenant || '') || !uuid.test(owner || '') || !uuid.test(client || '') || !audience) return null;
    const authorization = request.headers.get('authorization') || '';
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || authorization.length > 16384) return null;
    try {
      const { jwtVerify, createRemoteJWKSet } = await import('jose');
      remoteKeys ||= keys || createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`));
      const { payload } = await (verify || jwtVerify)(authorization.slice(7), remoteKeys, {
        issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
        audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'oid', 'tid', 'scp', 'ver', 'azp'],
        clockTolerance: 5,
      });
      if (payload.ver !== '2.0' || payload.tid !== tenant || payload.oid !== owner || payload.idtyp === 'app') return null;
      if (payload.azp !== client) return null;
      if (!String(payload.scp || '').split(' ').includes('CV.Read')) return null;
      // A password-only login, ID token, app token or missing MFA evidence fails closed.
      if (!Array.isArray(payload.amr) || !payload.amr.includes('mfa')) return null;
      return owner;
    } catch { return null; } // Never log tokens, claims, or identity-provider errors.
  };
}
