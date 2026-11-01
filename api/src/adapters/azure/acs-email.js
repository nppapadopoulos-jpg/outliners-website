// Azure Communication Services email adapter — REFERENCE IMPLEMENTATION.
// Honest status: written against @azure/communication-email v1 APIs but NOT
// executed anywhere in this repository (no ACS resource, no verified sender
// domain, and the info@outliners.gr mailbox is itself unconfirmed).
// Validate in staging before production use.

export function createAcsEmail(env) {
  const connectionString = env.ACS_CONNECTION_STRING;
  if (!connectionString) throw new Error("ACS_CONNECTION_STRING is required");

  let client = null;
  async function emailClient() {
    if (!client) {
      const { EmailClient } = await import("@azure/communication-email");
      client = new EmailClient(connectionString);
    }
    return client;
  }

  return {
    async send({ to, from, replyTo, subject, text }) {
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
