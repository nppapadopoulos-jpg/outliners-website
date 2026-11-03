import { app } from '@azure/functions';
import { createOwnerAuthenticator } from '../../../src/core/owner-auth.js';
import { createOwnerDownload } from '../../../src/core/owner-download.js';
import { createBlobStorage } from '../../../src/adapters/azure/storage-blob.js';

const authenticate = createOwnerAuthenticator(process.env);
app.http('ownerCvDownload', {
  methods: ['GET'], authLevel: 'anonymous', route: 'owner/cv/{id}',
  handler: async request => {
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    if (process.env.ENABLE_OWNER_DOWNLOAD !== 'true') return { status: 503, headers };
    const principalId = await authenticate(request);
    if (!principalId) return { status: 401, headers: { ...headers, 'www-authenticate': 'Bearer' } };
    try {
      const response = await createOwnerDownload({
        storage: createBlobStorage(process.env), ownerPrincipalId: process.env.OWNER_OBJECT_ID,
      })({ principalId, submissionId: request.params.id });
      return { status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) };
    } catch { return { status: 503, headers }; }
  },
});
