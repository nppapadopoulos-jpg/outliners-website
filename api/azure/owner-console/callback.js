// Dedicated MSAL v5 redirect bridge. Never read or log the response fragment.
msalRedirectBridge.broadcastResponseToMainFrame().catch(() => {
  document.body.textContent = 'Η σύνδεση δεν ολοκληρώθηκε. Κλείσε αυτό το παράθυρο και δοκίμασε ξανά.';
});
