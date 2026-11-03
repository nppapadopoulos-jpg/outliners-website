// Owner-only CV retrieval core. Never expose storage URLs or candidate data
// to anonymous callers. The hosting adapter MUST authenticate an individual
// identity with MFA and check the exact configured owner principal.
export function createOwnerDownload({ storage, ownerPrincipalId, audit = () => {} }) {
  if (!ownerPrincipalId || typeof ownerPrincipalId !== "string") throw new Error("Owner identity required");
  if (!storage || typeof storage.readSubmissionFile !== "function") throw new Error("Private storage reader required");
  return async function download({ principalId, submissionId }) {
    if (!principalId || principalId !== ownerPrincipalId) return new Response(null, { status: 403, headers: { "cache-control": "no-store" } });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId || "")) return new Response(null, { status: 400 });
    let result;
    try { result = await storage.readSubmissionFile(submissionId); }
    catch (error) {
      // This branch is reachable only after exact Owner authorization. Expose
      // a fixed operational category, never SDK messages, claims or credentials.
      let reason = 'unavailable';
      if (['CredentialUnavailableError', 'AuthenticationRequiredError', 'AuthenticationError'].includes(error?.name)) reason = 'identity';
      else if (error?.code === 'ContainerNotFound') reason = 'container-missing';
      else if ([401, 403].includes(error?.statusCode)) reason = 'access-denied';
      else if (error?.code === 'BlobNotFound') reason = 'missing-file';
      else if (error?.statusCode === 404) reason = 'resource-missing';
      else if (['ENOTFOUND', 'EAI_AGAIN', 'REQUEST_SEND_ERROR'].includes(error?.code)) reason = 'network';
      else if (error?.name === 'SyntaxError') reason = 'metadata';
      else if (error?.name === 'TypeError') reason = 'client-error';
      return new Response(null, { status: 503, headers: { 'cache-control': 'no-store', 'x-outliners-storage-failure': reason } });
    }
    if (!result) return new Response(null, { status: 404 });
    audit({ event: "owner-cv-download", id: submissionId });
    return new Response(result.bytes, { status: 200, headers: {
      "content-type": "application/octet-stream",
      "content-disposition": "attachment; filename=\"candidate-cv\"",
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    } });
  };
}
