// Only use this behind Azure App Service Authentication (Easy Auth).
// Caller-provided headers must never be accepted on an internet-facing endpoint.
// The platform principal header is trustworthy only when the platform's auth
// middleware is enabled and unauthenticated requests are rejected upstream.
export function ownerFromPlatformPrincipal(encoded, expectedOwnerId) {
  if (!encoded || !expectedOwnerId || typeof encoded !== "string") return null;
  let principal;
  try {
    principal = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch { return null; }
  if (!principal || !Array.isArray(principal.claims)) return null;
  const ids = principal.claims.filter(c =>
    c.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier" ||
    c.typ === "oid"
  ).map(c => c.val);
  return ids.length === 1 && ids[0] === expectedOwnerId ? ids[0] : null;
}
