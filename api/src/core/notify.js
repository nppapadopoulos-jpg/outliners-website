// Only operational references reach email; no candidate fields or CV filenames.
const TITLES = { 'request-talent': 'New hiring request', 'submit-cv': 'New candidate CV submission' };
export function buildNotification({ form, id, config }) {
  if (!TITLES[form] || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid notification reference');
  return {
    to: config.notifyEmail, from: config.senderEmail,
    subject: `${TITLES[form]} — ${id}`,
    text: `${TITLES[form]}\nSubmission reference: ${id}\nOpen the OutLiners Owner console using your Microsoft account and MFA.\nNo candidate details or attachments are included.`,
  };
}
