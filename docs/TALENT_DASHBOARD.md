# Talent Dashboard — verified 4 November 2026 (Athens)

Dashboard: https://func-outliners-api-8dc62205-cudka7c9c7hdajdk.northeurope-01.azurewebsites.net/api/owner/console

Functional source: PR #11 commit `76182b7c7e490d8808cd1fe49822a1ee3d78bdf7`.
CI #152 (`41727526276`) passed all 80 backend tests, packaging, page smoke and UI checks.
This supersedes the historical readiness lists in OWNER_ACCESS.md and
AZURE_BACKEND_STATUS.md. The PR remains draft and unmerged.

## Delivered

- Responsive Greek Owner workspace: search, type/state filters, 12-row pages,
  new/read markers, details, PDF canvas preview and private download.
- Existing single-tenant Entra Authorization Code + PKCE, exact Owner, tenant,
  issuer, audience, approved client, delegated CV.Read and `amr=mfa`. No auth
  requirement relaxed. Owner ID and cursor key remain in Azure only.
- Owner-only list/detail/review APIs, POST JSON search, HMAC cursors bound to
  filters/snapshot with expiry, bounded scans, record/path checks, explicit fields,
  no-store responses. No candidate data in URLs or public storage links.
- Memory-only tokens; no service worker/offline data cache. Logout, idle timeout
  and page lifecycle clearing remove private DOM content. Favorite/home-screen manifest.
- Existing private Blob container/Managed Identity. Review sidecars are deleted
  with their submission. No SAS or public storage access.
- Durable Blob-lease admission: 5/IP/hour, 100/day, 200/month, idempotent retries,
  streaming body limits, salted fingerprints rather than raw IPs.
- Storage independent of notifications. Ambiguous responses preserve CVs;
  matching pending files can resume. Hourly retention reconciles orphan files
  after a conservative 24-hour grace and prunes expired admission data.
- Future public POST wiring prepared. All four EN/EL forms retain
  `data-preview="true"`; Azure intake remains disabled.
- EN/EL privacy drafts cover purposes, rights, exact twelve-calendar-month
  retention and seven-day recovery. Final controller identity requires approval.

## Tests actually executed in Azure

The public intake gate stayed closed. A temporary bounded maintenance harness
called the production submission core and storage/admission adapters inside the
existing Function App with its existing Managed Identity. This verifies actual
Azure storage/application paths, not a public HTTP submission through a closed gate.

| Test | Observed result |
| --- | --- |
| Real Microsoft Owner login | Actual Entra token accepted with required MFA claim |
| Real private storage | 13 synthetic CVs and 3 client requests committed; one additional synthetic QA report |
| Browser pagination | 17 records, 12 on first page and 5 on second |
| Search/type/state filters | Company search: one; client filter: three; viewed filter: two after opening two records |
| Viewed state | Blob sidecars persisted; refresh/re-query retained state; new count 17 to 15 |
| PDF preview | PDF.js canvas displayed synthetic document, page 1/1 |
| Owner download | 659 bytes; SHA-256 `4066e7d3671d012a1200ae6be4eb2c085ba54f26156cd40517ddf9b44b4b1346`, exact fixture match |
| Injected email failure | All 16 submissions retained; no ACS send |
| Durable duplicate | Fresh handler/control returned same committed ID, no duplicate |
| Shared admission | Separate handler rejected configured synthetic per-IP over-limit request |
| Retention recovery | Expired fixture excluded; injected first deletion failure retained metadata; retry removed it |
| Orphan recovery | Normal grace preserved fresh fixture; scoped accelerated grace removed only synthetic orphan |
| Anonymous list/detail/review | Live HTTP 401 |
| Forged bearer | Live HTTP 401 |
| Anonymous Blob | Live HTTP 403 |
| Public CV/client POST | Live HTTP 503 |
| Logout/relogin | Private details removed; real Owner signed in again |
| Cleanup | Authenticated Dashboard returned zero records after synthetic fixture removal |

Temporary harness/phase configuration are removed and the clean production
package is restored after tests. Synthetic deletion uses existing seven-day
soft-delete recovery, not permanent purge.

No second real non-Owner login or validly signed real Entra token without MFA was
obtained. Wrong Owner/tenant/client/audience/scope, missing MFA, expiry and
signature failures are covered by signed synthetic-token automated tests, not
separate real-user sign-ins. Recovery tests inject errors/accelerate time only
for named fixtures; they do not claim a twelve-month wait or naturally scheduled
timer observation. A restart was issued; durable controls also use fresh adapter
instances in tests, rather than relying on process memory.

Desktop layout/modal/PDF were inspected in the deployed browser. Mobile CSS is
implemented, but physical iOS/Android login/download has not been tested. File
signature checks/canvas isolation are not malware scanning; downloaded files
retain the Owner device's normal security protections.

## Configuration and cost

Verified `ENABLE_LIVE_FORMS=false`, `ENABLE_EMAIL_NOTIFICATIONS=false`,
`ENABLE_OWNER_DOWNLOAD=true`, body limit 7,340,032 bytes. CV storage: public
network Disabled, anonymous false, Shared Key false; exactly one Private Endpoint.
No Entra permission/network expansion, public DNS or ATCOM email change.

No new service, endpoint, paid licence or resource created. Dashboard uses the
existing approved infrastructure. Earlier $8–$9/month remains a low-volume
estimate, not a billing cap. Intake quotas are not a cap against all hostile HTTP
traffic. Email stays optional and paused.

## Final launch requirements

1. Complete and approve the privacy notice's verified legal controller identity,
   contacts and legal basis, then remove the draft notice.
2. Explicitly approve PR merge/static publication and real form activation. These
   actions are not implied by deploying the private Dashboard.
3. At activation, verify existing public hosting/domain routing and a controlled
   public-origin submission. No DNS changes are authorized. An Owner mobile-device
   smoke test is recommended before depending on mobile use.

Email delivery/ATCOM migration is not a prerequisite for this workflow.
