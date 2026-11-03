// Azure Blob Storage adapter. Verified with synthetic data in Azure using
// Managed Identity and a Blob Private Endpoint. Public intake remains closed.
// See docs/AZURE_BACKEND_STATUS.md for the exact checks and remaining gates.
//
// Storage model (mirrors the tested local adapter):
//   <container>/submissions/<form>/<yyyy-mm>/<id>/submission.json
//   <container>/submissions/<form>/<yyyy-mm>/<id>/<sanitized-filename>
// The container MUST be private (no anonymous access); access for staff goes
// through Azure RBAC / Storage Explorer, never public URLs.

import { sanitizeFilename } from '../../core/validate.js';
const safeFilename = name => typeof name === 'string' && name.length > 0 && name === sanitizeFilename(name) && !['.', '..', 'submission.json'].includes(name);
export function createBlobStorage(env, { containerClient: injectedContainer, now = () => Date.now(), audit = () => {} } = {}) {
  const accountUrl = env.STORAGE_ACCOUNT_URL;
  const containerName = env.STORAGE_CONTAINER || "submissions";
  if (!accountUrl) throw new Error("STORAGE_ACCOUNT_URL is required");

  let containerClient = injectedContainer || null;
  async function container() {
    if (!containerClient) {
      const [{ BlobServiceClient }, { ManagedIdentityCredential }] = await Promise.all([
        import("@azure/storage-blob"),
        import("@azure/identity"),
      ]);
      const service = new BlobServiceClient(accountUrl, new ManagedIdentityCredential(env.AZURE_CLIENT_ID || undefined));
      containerClient = service.getContainerClient(containerName);
    }
    return containerClient;
  }

  return {
    async store({ id, form, record, file }) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '') || !['request-talent', 'submit-cv'].includes(form) || record.id !== id || record.form !== form || !Number.isFinite(Date.parse(record.receivedAt))) throw new Error('Invalid submission');
      if (file && (!safeFilename(file.storedName) || record.file?.name !== file.storedName)) throw new Error('Invalid filename');
      const month = record.receivedAt.slice(0, 7);
      const base = `submissions/${form}/${month}/${id}`;
      const c = await container();
      // Commit metadata last so partial uploads are not treated as submissions.
      try {
      if (file) {
        await c.getBlockBlobClient(`${base}/${file.storedName}`).uploadData(file.content, {
          blobHTTPHeaders: { blobContentType: "application/octet-stream" }, conditions: { ifNoneMatch: '*' },
        });
      }
      const payload = JSON.stringify(record, null, 2);
      await c.getBlockBlobClient(`${base}/submission.json`).upload(
        payload, Buffer.byteLength(payload),
        { blobHTTPHeaders: { blobContentType: "application/json" }, conditions: { ifNoneMatch: '*' } });
      } catch (error) {
        // An uncommitted file must not be left indefinitely without metadata.
        // Do not delete on a precondition failure: that could be an existing record.
        if (file && error.statusCode !== 412) {
          try { await c.deleteBlob(`${base}/${file.storedName}`); }
          catch { audit({ event: 'storage-rollback-failed', id }); }
        }
        throw error;
      }
      return base;
    },


    // Resolve a submission by UUID without accepting arbitrary blob paths.
    // Never expose a Blob URL, SAS token, or container credentials to callers.
    async readSubmissionFile(id) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "")) return null;
      let phase = 'client';
      try {
      const c = await container();
      phase = 'list';
      for (const form of ["submit-cv"]) {
        // Month is not supplied by the caller. Search only metadata paths.
        for await (const blob of c.listBlobsFlat({ prefix: `submissions/${form}/` })) {
          if (!blob.name.endsWith(`/${id}/submission.json`)) continue;
          const base = blob.name.slice(0, -"/submission.json".length);
          phase = 'metadata';
          const recordBlob = await c.getBlockBlobClient(blob.name).downloadToBuffer();
          const record = JSON.parse(recordBlob.toString("utf8"));
          if (record.id !== id || record.form !== form || !record.file?.name || !Number.isFinite(Date.parse(record.deleteAfter)) || Date.parse(record.deleteAfter) <= now()) return null;
          const filename = record.file.name;
          if (!safeFilename(filename)) return null;
          phase = 'properties';
          const props = await c.getBlockBlobClient(`${base}/${filename}`).getProperties();
          if (!Number.isInteger(props.contentLength) || props.contentLength > 5 * 1024 * 1024 || props.contentLength !== record.file.bytes) return null;
          phase = 'download';
          const bytes = await c.getBlockBlobClient(`${base}/${filename}`).downloadToBuffer();
          return { bytes };
        }
      }
      return null;
      } catch (error) {
        // Keep only operational fields for the Owner's fixed error categories.
        // SDK response bodies, request headers and URLs must not leave here.
        throw Object.assign(new Error('Private storage read failed'), {
          name: error?.name, code: error?.code, statusCode: error?.statusCode,
          storagePhase: phase,
        });
      }
    },

    async *list() {
      const c = await container();
      for await (const blob of c.listBlobsFlat({ prefix: "submissions/" })) {
        if (!blob.name.endsWith("/submission.json")) continue;
        const relPath = blob.name.slice(0, -"/submission.json".length);
        let record;
        try {
          const raw = await c.getBlockBlobClient(blob.name).downloadToBuffer();
          record = JSON.parse(raw.toString('utf8'));
        } catch { audit({ event: 'retention-record-unreadable' }); continue; }
        yield { relPath, record };
      }
    },

    // Data-subject deletion: remove every blob under the submission prefix.
    async deleteSubmission(relPath) {
      if (typeof relPath !== "string" || !/^submissions\/(request-talent|submit-cv)\/\d{4}-\d{2}\/[0-9a-f-]{36}$/i.test(relPath)) throw new Error("Invalid submission path");
      const c = await container();
      // Metadata is the retry marker: delete it only after every attachment is gone.
      // Azure soft delete retains recoverability for the configured seven days.
      const names = [];
      for await (const blob of c.listBlobsFlat({ prefix: relPath + '/' })) names.push(blob.name);
      const metadata = `${relPath}/submission.json`;
      for (const name of names.filter(name => name !== metadata)) {
        try { await c.deleteBlob(name); } catch (e) { if (e.statusCode !== 404) throw e; }
      }
      try { await c.deleteBlob(metadata); } catch (e) { if (e.statusCode !== 404) throw e; }
    },
  };
}

// Retention in Azure is enforced by a Blob lifecycle management rule
// (delete blobs under submissions/ older than RETENTION_DAYS), configured on
// the storage account at deploy time — see docs/BACKEND_DEPLOYMENT.md §GDPR.
