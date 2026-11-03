# OutLiners private backend — verified deployment and remaining gates

## Approved Azure deployment, 2026-11-03

The owner approved Functions Flex Consumption, Managed Identity, one Blob
Private Endpoint and the internal `privatelink.blob.core.windows.net` zone at an
estimated USD 8–9/month before tax for the previously modelled low-volume use.
This is a usage estimate, not an Azure spending cap. Public DNS, live forms and
GitHub merges remain outside the deployment authorization.

The following resources were created/reused in OUTLINERS subscription
`8dc62205-4b91-4b6f-aede-40bc8ba1d217`, group `rg-outliners-backend`, North Europe:

| Resource | Verified configuration |
| --- | --- |
| `func-outliners-api-8dc62205` | Flex Consumption, Node 22, Running, 512 MB, maximum 40 instances, no Always Ready instances configured |
| `ASP-rgoutlinersbackend-897c` | FC1 / Flex Consumption plan |
| `func-outliners-api-8dc62205-uami` | User-assigned managed identity; host/deployment access separated from CV container access |
| `stoutlinersrt8dc62205` | Separate Standard LRS runtime/deployment storage, Shared Key and anonymous access disabled, selected-subnet access via Storage service endpoint |
| `stoutlinerscv8dc62205` | Existing Standard Hot LRS CV storage reused; private `submissions` container |
| `vnet-outliners-backend` | `snet-functions` for Flex; separate non-delegated `snet-private-endpoints` |
| `pe-outliners-cv-blob` | Exactly one Private Endpoint, Blob subresource, connection Approved |
| `pe-outliners-cv-blob-nic` | Network interface belonging to that endpoint |
| `privatelink.blob.core.windows.net` | Exactly one VNet link, to `vnet-outliners-backend`; link Completed, autoregistration disabled |

CV storage still has public network access Disabled, anonymous access false,
Shared Key false, HTTPS required and TLS 1.2 minimum. Blob/container soft delete
remains seven days and versioning remains disabled. No CV storage account was
duplicated. No NAT Gateway, Private Resolver, extra Private Endpoint, Application
Insights, Log Analytics or ACS Email service was created.

The initial portal deployment hit a subnet/storage dependency race. The same
resources were reused with an explicit dependency on the subnet deployment;
the corrected Azure deployment succeeded. No paid plan upgrade was used.

## Deployed code and gates

Current functional code is PR #11 commit
`4739cd20811cf7dc2203ec0902a131081d647485`, deployed to the same Function App.
The full staged API includes `api/src`, `api/azure` and lockfile dependencies.
Real Owner login/MFA and a private synthetic CV download have now succeeded; see
[Owner access verification](OWNER_ACCESS.md) for exact evidence and limitations.
No merge was performed. The existing Free SWA remains in the ATCOM subscription.

- `ENABLE_LIVE_FORMS=false`; both public POST endpoints return HTTP 503 with
  `forms-not-live` before accessing storage or email.
- `ENABLE_OWNER_DOWNLOAD=true`: real Owner/MFA verification and a private
  synthetic CV download succeeded. The fixture was cleaned up and its real
  authenticated download subsequently returned 404. See [Owner access](OWNER_ACCESS.md).
- `ENABLE_EMAIL_NOTIFICATIONS=false`; `NOTIFY_EMAIL=info@outliners.gr` prepared.
- `ENABLE_RETENTION_TIMER=true`, `RETENTION_MONTHS=12` configured.
- Existing lifecycle rule `submissions-retention-365-days` was disabled; fixed
  365-day age is not an exact twelve-calendar-month retention policy.
- `AZURE_CLIENT_ID` selects the runtime managed identity. Its CV permission is
  Storage Blob Data Contributor scoped to `submissions`, not the CV account.
- An unpredictable `IP_HASH_SALT` was generated and stored in Azure app settings;
  its value, function keys and tokens were not printed or committed.

The owner-download implementation verifies signed Entra delegated JWTs including
issuer, audience, expiry, tenant, exact Owner object ID, approved client,
`CV.Read` and `amr` containing `mfa`. Actual Entra Owner/MFA verification and a
private synthetic download succeeded, alongside signed synthetic-token negative
tests. No second real non-Owner/no-MFA identity was used.

## Tests actually executed

### Local and Cloud Shell tests

The earlier 55-test package passed locally and in ephemeral Cloud Shell. The
current 60-test backend suite passed locally and in full CI #142 for the tested
Owner/storage code, together with the 25-page smoke suite and UI regression
checks. These include signed-token negative cases, EN/EL multipart flows,
conflict-safe rollback, expiry, deletion retry and mocked ACS delivery.
The staged package imports successfully; importing alone is not a Functions
host test.

### Real Azure runtime and storage tests

A temporary admin-key-protected diagnostic function ran inside the deployed
Function App. It used real Managed Identity credentials and real Blob SDK calls,
with only a generated UUID, a synthetic PDF marker and synthetic metadata.
It did not enable either public intake endpoint and did not send email.

Verified results from that live function:

| Check | Result |
| --- | --- |
| Storage hostname resolves to private endpoint subnet address | Passed |
| Managed Identity writes synthetic CV and metadata | Passed |
| Private read returns exactly the original bytes | Passed |
| Read denied after the synthetic record's expiry using an injected clock | Passed |
| Retention dry run leaves the record intact | Passed |
| Injected first deletion failure preserves the real metadata retry marker | Passed |
| Retry deletes the real CV blob and metadata | Passed |
| No active blobs remain under the synthetic submission prefix | Passed |

The failure and clock were intentionally injected; they are not evidence of an
actual Azure outage or a year of elapsed time. Real blob operations were used.
Deletion was scoped to the one synthetic UUID; unrelated records were not deleted.
Soft-deleted test blobs follow the existing seven-day recovery policy.

Anonymous POSTs to both real intake endpoints returned 503 `forms-not-live`.
Anonymous access to the temporary diagnostic returned 401. After testing, the
original PR #11 package was redeployed and the diagnostic URL returned 404.
An anonymous external CV-container listing returned 403 before deployment.

The hourly `purgeExpiredSubmissions` timer was registered after a restart and
trigger sync. The registered function list contains the two closed forms, owner
download and retention timer; no diagnostic function remains. An actual scheduled
hourly run has not been observed; the real deletion was exercised by the isolated
synthetic probe.

A monthly `outliners-backend-monthly` budget was created at the resource-group
scope, EUR 8 (billing-profile currency verified), with 50/75/100 percent
actual-spend notifications to `info@outliners.gr`. This budget is an alert only,
not a spending cap. No current-month invoice or complete usage bill is available
yet; the USD 8–9 figure remains an estimate.

## Remaining go-live gates

1. Owner login, actual Entra MFA-token validation and a private synthetic CV
   download are verified. Keep exact Owner/client/tenant/audience/scope/MFA
   enforcement. Additional real-user negative identity tests may extend the
   signed-token suite; no new identity licence was purchased.
2. ACS Email resources and a verified Azure-managed sender have not been created.
   Obtain any necessary explicit service approval, configure least-privilege
   email-send access and verify synthetic delivery to `info@outliners.gr`.
   No public outliners.gr DNS change is needed for an Azure-managed sender.
3. Implement durable email retry/reconciliation; current email failures preserve
   submissions but do not provide a durable delivery outbox.
4. Verify scheduled retention execution and operational alerting/recovery. Purge
   deletes metadata last for retry; corrupt metadata requires investigation.
   Twelve UTC calendar months is the logical deletion deadline; seven-day soft
   delete and asynchronous physical cleanup follow it.
5. Complete abuse controls across multiple instances (current in-memory limits
   alone are insufficient), orphan reconciliation for ambiguous upload outcomes,
   operational cost monitoring, and production review.
   Cost budgets alert; they do not enforce a hard maximum bill.
6. Pass CI and obtain a separate explicit go-live decision. Do not merge or enable
   real forms as part of this staging deployment.

## Primary documentation

- https://learn.microsoft.com/azure/azure-functions/flex-consumption-plan
- https://learn.microsoft.com/azure/azure-functions/configure-networking-how-to
- https://learn.microsoft.com/azure/storage/common/storage-private-endpoints
- https://learn.microsoft.com/azure/azure-functions/functions-deployment-technologies
- https://learn.microsoft.com/entra/identity-platform/optional-claims-reference
- https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets
