// Azure Communication Services email adapter — REFERENCE IMPLEMENTATION.
// Honest status: written against @azure/communication-email v1 APIs but NOT
// executed anywhere in this repository (no ACS resource, no verified sender
// domain, and the info@outliners.gr mailbox is itself unconfirmed).
// Validate in staging before production use.

export function createAcsEmail(env, { client: injectedClient } = {}) {
  const connectionString = env.ACS_CONNECTION_STRING;
  if (!connectionString && !env.ACS_ENDPOINT && !injectedClient) throw new Error("ACS_ENDPOINT is required");

  let client = injectedClient || null;
  async function emailClient() {
    if (!client) {
      const { EmailClient } = await import("@azure/communication-email");
      const { ManagedIdentityCredential } = await import('@azure/identity');
      client = connectionString ? new EmailClient(connectionString) : new EmailClient(env.ACS_ENDPOINT, new ManagedIdentityCredential(env.AZURE_CLIENT_ID || undefined));
    }
    return client;
  }

  return {
    async send({ to, from, replyTo, subject, text }) {
      if (env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') return { delivered: false, disabled: true };
      const c = await emailClient();
      const poller = await c.beginSend({
        senderAddress: from,
        recipients: { to: [{ address: to }] },
        replyTo: replyTo ? [{ address: replyTo }] : undefined,
        content: { subject, plainText: text },
      });
      const result = await poller.pollUntilDone();
      if (result.status !== "Succeeded") {
        const err = new Error("email send failed");
        err.code = result.status;
        throw err;
      }
      return { delivered: true, id: result.id };
    },
  };
}
