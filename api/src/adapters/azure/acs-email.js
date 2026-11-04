// Entra Managed Identity only. Raw responses, tokens and provider errors never logged.
import { buildNotification } from '../../core/notify.js';
export function createAcsEmail(env, { credential: supplied, fetch: request = globalThis.fetch } = {}) {
  let credential = supplied;
  const endpoint = new URL(env.ACS_ENDPOINT || 'https://unconfigured.communication.azure.com');
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.communication.azure.com') || endpoint.pathname !== '/') throw new Error('Invalid ACS endpoint');
  async function call(method, path, body, headers = {}) {
    if (env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') return { disabled: true };
    if (!credential) { const { ManagedIdentityCredential } = await import('@azure/identity'); credential = new ManagedIdentityCredential(env.AZURE_CLIENT_ID || undefined); }
    const token = await credential.getToken('https://communication.azure.com/.default');
    const response = await request(new URL(path, endpoint), { method, headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000), redirect: 'error' });
    const retry = response.headers.get('retry-after');
    const delay = /^\d+$/.test(retry || '') ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now()) || 0;
    if (!response.ok) return { http: response.status, retryAfterMs: delay };
    let data; try { data = await response.json(); } catch { return { http: response.status, status: 'Unknown' }; }
    return { http: response.status, status: ['NotStarted','Running','Succeeded','Failed','Canceled'].includes(data.status) ? data.status : 'Unknown', retryAfterMs: delay };
  }
  return {
    async submit(state) {
      const message = buildNotification({ form: state.form, id: state.id, config: { notifyEmail: 'info@outliners.gr', senderEmail: env.SENDER_EMAIL } });
      if (!/^[^\s@]+@[^\s@]+\.azurecomm\.net$/.test(message.from || '')) throw new Error('Azure managed sender required');
      return call('POST', '/emails:send?api-version=2023-03-31', { senderAddress: message.from, recipients: { to: [{ address: message.to }] }, content: { subject: message.subject, plainText: message.text }, userEngagementTrackingDisabled: true }, { 'Operation-Id': state.operationId, 'Repeatability-Request-Id': state.operationId, 'Repeatability-First-Sent': new Date(state.firstSent).toUTCString() });
    },
    status(state) { return call('GET', `/emails/operations/${state.operationId}?api-version=2023-03-31`); },
  };
}
