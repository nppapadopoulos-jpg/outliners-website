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
