'use strict';
(async () => {
  const login = document.getElementById('login');
  const clear = document.getElementById('clear');
  const getCv = document.getElementById('get-cv');
  const status = document.getElementById('status');
  let account = null;
  let client;
  let scopes;
  const say = text => { status.textContent = text; };
  const reset = () => { account = null; getCv.disabled = true; clear.disabled = true; };
  const request = () => ({ scopes, account, claims: JSON.stringify({ access_token: { amr: { essential: true, values: ['mfa'] } } }) });
  try {
    const response = await fetch('/api/owner/config', { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error();
    const config = await response.json();
    scopes = [`api://${config.audience}/CV.Read`];
    client = new msal.PublicClientApplication({
      auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${config.tenantId}`, redirectUri: `${location.origin}/api/owner/callback` },
      cache: { cacheLocation: 'memoryStorage' },
      // Allow the Owner time to finish the secure account/MFA handoff. This
      // changes popup waiting only, never token expiry or the API's MFA checks.
      system: { popupBridgeTimeout: 600000, loggerOptions: { loggerCallback: () => {}, piiLoggingEnabled: false } },
    });
    await client.initialize();
    login.disabled = false;
    say('Συνδέσου για να επιβεβαιωθούν Owner και MFA από το API.');
  } catch { say('Η πρόσβαση Owner δεν είναι διαθέσιμη.'); return; }
  async function verify(accessToken) {
    const response = await fetch('/api/owner/session', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', credentials: 'omit', redirect: 'error' });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (result.owner !== true || result.mfa !== true) throw new Error();
  }
  login.addEventListener('click', async () => {
    login.disabled = true;
    reset();
    try {
      const result = await client.acquireTokenPopup({ ...request(), prompt: 'select_account' });
      await verify(result.accessToken);
      account = result.account;
      getCv.disabled = false;
      clear.disabled = false;
      say('Επιβεβαιώθηκαν Owner και MFA. Η λήψη CV είναι διαθέσιμη.');
    } catch (error) {
      await client.clearCache();
      // A fixed allowlisted category is safe; never print provider messages,
      // error objects, tokens or claims.
      if (['monitor_popup_timeout', 'timed_out', 'popup_bridge_timeout'].includes(error?.errorCode)) {
        say('Έληξε ο χρόνος αναμονής της σύνδεσης Microsoft. Συνδέσου ξανά για να ολοκληρώσεις το MFA.');
      } else {
        say('Η πρόσβαση απορρίφθηκε ή η σύνδεση ακυρώθηκε. Απαιτείται ο σωστός Owner και έγκυρο MFA.');
      }
    } finally { login.disabled = false; }
  });
  clear.addEventListener('click', async () => {
    reset();
    await client.clearCache();
    document.getElementById('submission').value = '';
    say('Η τοπική συνεδρία έκλεισε.');
  });
  document.getElementById('download').addEventListener('submit', async event => {
    event.preventDefault();
    if (!account) return;
    const id = document.getElementById('submission').value.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { say('Χρειάζεται έγκυρος κωδικός υποβολής.'); return; }
    getCv.disabled = true;
    let tokenReady = false;
    let apiStatus = null;
    let storageFailure = null;
    try {
      const result = await client.acquireTokenSilent(request());
      tokenReady = true;
      const response = await fetch(`/api/owner/cv/${id}`, { headers: { Authorization: `Bearer ${result.accessToken}` }, cache: 'no-store', credentials: 'omit', redirect: 'error' });
      apiStatus = response.status;
      storageFailure = response.headers.get('x-outliners-storage-failure');
      if (!response.ok) throw new Error();
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl; link.download = 'candidate-cv'; link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      say('Το CV λήφθηκε μέσω του ιδιωτικού Owner API.');
    } catch {
      // Only fixed messages and the HTTP outcome; no provider error or token.
      if (!tokenReady || apiStatus === 401) say('Χρειάζεται νέα σύνδεση Microsoft με MFA πριν από τη λήψη.');
      else if (apiStatus === 404) say('Το CV δεν βρέθηκε ή έχει λήξει η περίοδος διατήρησής του.');
      else if (apiStatus === 503) {
        const messages = {
          'access-denied': 'Δεν υπάρχει η απαιτούμενη άδεια σύνδεσης με την ιδιωτική αποθήκευση.',
          'missing-file': 'Το αρχείο του CV δεν είναι διαθέσιμο στην ιδιωτική αποθήκευση.',
          network: 'Η ιδιωτική σύνδεση δικτύου με την αποθήκευση δεν είναι διαθέσιμη.',
          identity: 'Η ασφαλής ταυτοποίηση της εφαρμογής στο storage δεν είναι διαθέσιμη.',
          metadata: 'Τα στοιχεία αποθήκευσης του CV χρειάζονται έλεγχο.',
          'client-error': 'Ο μηχανισμός ανάγνωσης του CV χρειάζεται τεχνικό έλεγχο.',
        };
        say(messages[storageFailure] || 'Η ιδιωτική αποθήκευση δεν είναι προσωρινά διαθέσιμη. Δοκίμασε ξανά αργότερα.');
      }
      else say('Η λήψη δεν ολοκληρώθηκε. Δοκίμασε ξανά αργότερα.');
    }
    finally { getCv.disabled = !account; }
  });
})();
