import { app } from '@azure/functions';
import { createNotificationRepository } from '../../../src/adapters/azure/notification-outbox.js';
import { createAcsEmail } from '../../../src/adapters/azure/acs-email.js';
import { runNotificationCycle } from '../../../src/core/notification-outbox.js';
if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
  app.timer('dispatchSubmissionNotifications', {
    schedule: '0 */10 * * * *',
    handler: async (_timer, context) => {
      try {
        const result=await runNotificationCycle({repository:createNotificationRepository(process.env),transport:createAcsEmail(process.env),env:process.env});
        context.log('Notification cycle',result.outcome);
      } catch { context.error('Notification cycle incomplete; durable state retained');throw new Error('Notification cycle failed'); }
    },
  });
}
