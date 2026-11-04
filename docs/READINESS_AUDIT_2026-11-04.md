# Backend and Talent Dashboard readiness — 4 November 2026 (Athens)

## Current released code

The OUTLINERS Function App now runs the clean release of source commit
177a521736b51c1fd59c78bab54364a3b441040d. PR #11 remains draft and unmerged.
This supersedes the older deployed-version notes in TALENT_DASHBOARD.md and
GO_LIVE_RUNBOOK.md; it does not authorize intake activation or a merge.

Before this audit, the live console fingerprint matched the older 76182b7
version and the early-erasure function was absent. The private backend was
updated while public intake and email stayed disabled.

A real Azure erasure test found a UI lifecycle race: the dialog-close handler
advanced the request generation after the refresh began, causing that refresh
to be discarded. The server had correctly excluded the record, but the old row
remained visible until refresh. The committed fix awaits dialog close before
reloading. Repeating erasure removed the row immediately without manual refresh.

Clean ZIP SHA-256:
636d828c0376fd799f7b29e9a1c5e4802cab5d5d26570151bc5db2b735d10816

The actual served console.js Git blob fingerprint matched the committed
b09c450a23aeaf559460abe059e96b4cb58cf52b after the final clean deployment.
The temporary QA function was absent from the function registry and its route
returned 404.

## Actual verification

| Check | Result and scope |
| --- | --- |
| Source tests | 84/84 backend tests passed in an isolated ephemeral sandbox; local fixture folders removed. Smoke and SEO passed. CI #182 passed for the released code. |
| Real Owner identity | Desktop Microsoft/Entra login succeeded; the server's strict Owner/session API attested MFA. No token was inspected or copied. |
| Physical mobile | Owner confirmed successful login from his own mobile device. This is user-confirmed login evidence, not an agent-run mobile CV download. |
| Private Azure storage | Public network Disabled, anonymous Blob false, Shared Key false, exactly one existing Private Endpoint. Managed Identity retained its existing scoped storage roles; no IAM/network change. |
| Controlled Azure submissions | A temporary host-key-protected harness invoked the same core and private storage/durable-admission adapters. Two synthetic CVs (pool and specific role) plus one client request were committed and appeared in the authenticated Dashboard. The public HTTP intake gate was never opened. |
| Durable duplicate | A fresh handler/admission adapter returned the original committed ID without another submission. State survived subsequent package deployments. |
| Notifications independent | Injected synthetic email failure preserved every committed record; no ACS call or real email was sent. |
| Dashboard | Both submission types and details rendered; client-type filter returned one request. PDF.js rendered the synthetic PDF as one page. |
| Owner download | Actual browser download through the authenticated Owner API: 623 bytes; SHA-256 69c5dd5372ad417f89c544baccbffd5366b9000256b665db5f0a84ad18b04d05, exact fixture match. Downloaded test file subsequently removed. No Blob/SAS URL exposed. |
| Retention purposes | Actual stored deadlines/UI showed 12 calendar months for pool/client and 3 calendar months for a specific-role-only CV. |
| Deletion recovery | A fixture-scoped injected Blob deletion failure preserved metadata for retry; retry removed the expired PDF and metadata. |
| Actual maintenance handler | The existing purgeExpiredSubmissions function was manually invoked through its authorized admin endpoint (202). The erased CV prefix disappeared from active storage, leaving only the nonexpired client fixture before cleanup. No claim of waiting three/twelve months or observing the next natural hourly schedule. |
| Cleanup | All active synthetic attachments, metadata, review sidecars and QA control/report blobs removed; scoped remaining count zero and authenticated Dashboard zero. Existing seven-day soft-delete recovery remains; no permanent purge. |
| Owner negatives | Anonymous/forged requests rejected with 401. Exact Owner/tenant/audience/client/scope, expiry, signature and missing-MFA negatives covered by signed synthetic-token tests; no second real non-Owner/password-only Entra session was obtained. |
| Final public gates | Both public intake POSTs still 503; all four EN/EL pages still preview=true. |
| Production CORS | outliners.gr and www.outliners.gr preflights returned their exact allowed origin; untrusted origin received none. Existing portal/staging allowlist entries retained; credentials false, no wildcard. |
| Published policies/consent | EN/EL Privacy and Cookies HTTP 200, no draft notice; purpose limits and seven-day recovery published. Actual production browser loaded no Google script before consent or after rejection, loaded G-RSEFT347TW after opt-in, and removed it after revocation. Real GA4 account receipt was not audited. |

## Final boundaries

ENABLE_LIVE_FORMS=false; ENABLE_EMAIL_NOTIFICATIONS=false;
ENABLE_OWNER_DOWNLOAD=true; ENABLE_RETENTION_TIMER=true; RETENTION_MONTHS=12.

No new Azure resource, paid licence, DNS/mail change, email notification enablement
or GitHub merge. Temporary harness code was never committed and was removed from
the active deployment and temporary working copies. The clean release includes
the Owner early-erasure function and retains the existing hourly maintenance timer.

Technically ready for an Owner-approved controlled activation. That later action
must separately enable both backend intake gates and public HTML, keep email off,
and perform one synthetic public-origin CV/client canary followed by Owner
verification and cleanup. Public-origin success cannot be claimed while the gate
is deliberately closed.
