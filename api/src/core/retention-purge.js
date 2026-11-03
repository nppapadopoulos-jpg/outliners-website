// Hosting-independent expiry purge. Supply a private storage adapter with
// list() and deleteSubmission() methods; no scheduler or cloud resource created.
export async function purgeExpired({ storage, now = Date.now(), audit = () => {}, dryRun = true }) {
  if (!storage || typeof storage.list !== "function" || typeof storage.deleteSubmission !== "function") throw new Error("Private storage adapter with list/delete required");
  let examined = 0, expired = 0, deleted = 0, failed = 0;
  for await (const entry of storage.list()) {
    examined++;
    const deadline = entry.record?.deleteAfter;
    if (!deadline || !Number.isFinite(Date.parse(deadline))) continue;
    if (Date.parse(deadline) > now) continue;
    expired++;
    if (!dryRun) {
      try {
        await storage.deleteSubmission(entry.relPath);
        deleted++;
        audit({ event: "retention-deleted", id: entry.record.id });
      } catch {
        failed++;
        audit({ event: 'retention-delete-failed', id: entry.record.id });
      }
    }
  }
  return { examined, expired, deleted, failed, dryRun };
}
