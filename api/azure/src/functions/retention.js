// Deploy only after private storage and managed identity have been configured.
// A timer trigger is deliberately not registered in preview mode.
import { app } from '@azure/functions';
import { createBlobStorage } from '../../../src/adapters/azure/storage-blob.js';
import { createBlobControl } from '../../../src/adapters/azure/blob-control.js';
import { createDurableAdmission } from '../../../src/core/durable-admission.js';
import { purgeExpired } from '../../../src/core/retention-purge.js';

if (process.env.ENABLE_RETENTION_TIMER === 'true') {
  app.timer('purgeExpiredSubmissions', {
    schedule: '0 0 * * * *',
    handler: async (_timer, context) => {
      const storage = createBlobStorage(process.env, { audit: event => context.warn(event.event) });
      const result = await purgeExpired({ storage, dryRun: false });
      context.log('Retention purge completed', result);
      const orphans = await storage.reconcileOrphans();
      await createDurableAdmission({control:createBlobControl(process.env,'security/intake-control.json'),storage,secret:process.env.IP_HASH_SALT}).cleanup();
      context.log('Orphan reconciliation completed', orphans);
      if (orphans.failed || result.failed) throw new Error('Retention incomplete; metadata retained for retry');
    },
  });
}
