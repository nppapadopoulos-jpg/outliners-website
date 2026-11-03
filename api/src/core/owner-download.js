// Owner-only CV retrieval core. Never expose storage URLs or candidate data
// to anonymous callers. The hosting adapter MUST authenticate an individual
// identity with MFA and check the exact configured owner principal.
export function createOwnerDownload({ storage, ownerPrincipalId, audit = () => {} }) {
  if (!ownerPrincipalId || typeof ownerPrincipalId !== "string") throw new Error("Owner identity required");
  if (!storage || typeof storage.readSubmissionFile !== "function") throw new Error("Private storage reader required");
  return async function download({ principalId, submissionId }) {
    if (!principalId || principalId !== ownerPrincipalId) return new Response(null, { status: 403, headers: { "cache-control": "no-store" } });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId || "")) return new Response(null, { status: 400 });
    const result = await storage.readSubmissionFile(submissionId);
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
