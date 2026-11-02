// Azure Blob Storage adapter — REFERENCE IMPLEMENTATION.
// Honest status: written against @azure/storage-blob v12 APIs but NOT
// executed anywhere in this repository (no Azure resources or credentials
// exist, by design). Validate in staging before production use.
//
// Storage model (mirrors the tested local adapter):
//   <container>/submissions/<form>/<yyyy-mm>/<id>/submission.json
//   <container>/submissions/<form>/<yyyy-mm>/<id>/<sanitized-filename>
// The container MUST be private (no anonymous access); access for staff goes
// through Azure RBAC / Storage Explorer, never public URLs.

export function createBlobStorage(env) {
  const accountUrl = env.STORAGE_ACCOUNT_URL;
  const containerName = env.STORAGE_CONTAINER || "submissions";
  if (!accountUrl) throw new Error("STORAGE_ACCOUNT_URL is required");

  let containerClient = null;
  async function container() {
    if (!containerClient) {
      const [{ BlobServiceClient }, { DefaultAzureCredential }] = await Promise.all([
        import("@azure/storage-blob"),
        import("@azure/identity"),
      ]);
      const service = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
      containerClient = service.getContainerClient(containerName);
    }
    return containerClient;
  }

  return {
    async store({ id, form, record, file }) {
      const month = record.receivedAt.slice(0, 7);
      const base = `submissions/${form}/${month}/${id}`;
      const c = await container();
      await c.getBlockBlobClient(`${base}/submission.json`).upload(
        JSON.stringify(record, null, 2), Buffer.byteLength(JSON.stringify(record, null, 2)),
        { blobHTTPHeaders: { blobContentType: "application/json" } });
      if (file) {
        await c.getBlockBlobClient(`${base}/${file.storedName}`).uploadData(file.content, {
          blobHTTPHeaders: { blobContentType: "application/octet-stream" },
        });
      }
      return base;
    },


    // Resolve a submission by UUID without accepting arbitrary blob paths.
    // Never expose a Blob URL, SAS token, or container credentials to callers.
    async readSubmissionFile(id) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "")) return null;
      const c = await container();
      for (const form of ["submit-cv"]) {
        // Month is not supplied by the caller. Search only metadata paths.
        for await (const blob of c.listBlobsFlat({ prefix: `submissions/${form}/` })) {
          if (!blob.name.endsWith(`/${id}/submission.json`)) continue;
          const base = blob.name.slice(0, -"/submission.json".length);
          const recordBlob = await c.getBlockBlobClient(blob.name).downloadToBuffer();
          const record = JSON.parse(recordBlob.toString("utf8"));
          if (record.id !== id || !record.file?.name || (record.deleteAfter && Date.parse(record.deleteAfter) <= Date.now())) return null;
          const filename = record.file.name;
          if (filename.includes("/") || filename.includes("\\\\") || filename === "." || filename === "..") return null;
          const bytes = await c.getBlockBlobClient(`${base}/${filename}`).downloadToBuffer();
          return { bytes };
        }
      }
      return null;
    },

    // Data-subject deletion: remove every blob under the submission prefix.
    async deleteSubmission(relPath) {
      const c = await container();
      for await (const blob of c.listBlobsFlat({ prefix: relPath + "/" })) {
        await c.deleteBlob(blob.name);
      }
    },
  };
}

// Retention in Azure is enforced by a Blob lifecycle management rule
// (delete blobs under submissions/ older than RETENTION_DAYS), configured on
// the storage account at deploy time — see docs/BACKEND_DEPLOYMENT.md §GDPR.
