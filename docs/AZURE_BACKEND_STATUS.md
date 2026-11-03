# OutLiners private backend — verified state and deployment gates

## Observed in Azure, 2026-11-03

- OUTLINERS directory, personal Microsoft sign-in with MFA. Active subscription
  `8dc62205-4b91-4b6f-aede-40bc8ba1d217`; subscription IAM showed only Nikos as Owner.
- All-resources inventory in that subscription: **one resource**, storage account
  `stoutlinerscv8dc62205`, resource group `rg-outliners-backend`, North Europe,
  Standard StorageV2 / Hot / LRS. No Function App, ACS Email or private endpoint.
- Storage creation succeeded. `submissions` exists and is Private. Anonymous
  blob access, Shared Key authorization, public network access and cross-tenant
  replication are disabled. HTTPS and TLS 1.2 are required. Blob/container soft
  delete is seven days; versioning is off. These are control-plane observations,
  **not** a successful live upload/download test. An unauthenticated container
  listing request from the executor returned HTTP 403; no response data was printed.
- The existing Free SWA remains in the ATCOM subscription. Its public Azure URL
  serves both intake pages in preview mode (`data-preview="true"`), confirmed
  through their rendered DOM. No second SWA was created or migration performed.
- Existing Azure lifecycle rule `submissions-retention-365-days` is enabled.
  This is **not twelve calendar months** when a leap day intervenes.

## Code completed on this branch, not deployed

- Both POST endpoints return 503 before parsing a body or constructing storage
  or email clients unless **both** live-forms switches are explicitly approved.
- `/api/owner/cv/{id}` validates a signed Entra delegated JWT: RS256/JWKS,
  issuer, audience, expiry, tenant, exact Owner object ID, approved client ID,
  `CV.Read` scope and `amr` containing `mfa`. Caller-created principal headers,
  app-only tokens, ID tokens without delegated scope and missing MFA evidence
  are rejected. The download endpoint is disabled by default.
- Blob/ACS adapters support managed identity; no SAS, access key or storage URL
  is returned to download callers. Download responses are attachments and
  non-cacheable. Email text contains a private reference, not a download grant,
  CV attachment or candidate field dump. Email is separately disabled by default.
- Metadata `deleteAfter` is computed from the same `receivedAt` timestamp using
  twelve UTC calendar months with end-of-month clamping (Feb 29 → Feb 28).
  Expired CVs are refused even before the hourly cleanup pass.
- Purge deletes attachments before the metadata retry marker. A per-submission
  failure does not stop other records; a failed timer run is visible and the
  next run retries. Corrupt metadata is skipped and emits a metadata-only alert
  for operator investigation; it is never silently interpreted as safe to delete.
- One complete deployment unit now includes both shared `api/src` and Azure
  entry points, with a locked dependency tree. Deploying `api/azure` alone was
  incomplete. The packaging helper neither provisions nor deploys anything.

## Actual tests vs. unperformed tests

Local tests exercise signed JWTs using synthetic RSA keys, negative authorization
cases, both closed entry points, four EN/EL submission flows through an in-memory
Blob SDK interface, private reads, expiry, partial deletion/retry, rollback and
ACS success/failure/disabled behavior. Local HTTP tests also exercise multipart
validation. No real CVs, credentials or Azure tokens are test fixtures.

These tests do **not** establish that Azure networking, runtime triggers, managed
identity RBAC, real Microsoft token issuance/MFA or real email delivery work.
Those remain staging gates. A Node import of the staged Azure package verifies
module resolution only; it does not run the Azure Functions host.

## Next deployment — explicit cost approval required

1. Re-check inventory before provisioning; reuse the existing account/container.
2. Approve an Azure Functions **Flex Consumption** app (Node 22, zero always-ready
   instances), managed identity, and private networking to existing storage.
   A VNet plus Blob private endpoint and internal name resolution is the proposed
   path. Private endpoint/DNS and runtime/storage operations can incur charges;
   no such resource has been provisioned. Public outliners.gr DNS stays unchanged.
   Do not link a standalone backend to Free SWA through a Standard-plan upgrade.
   Use an independent backend origin and exact allowed frontend origins instead.
3. Host/deployment storage must be separated from `submissions`; do not grant
   host-level Blob Data Owner or subscription-wide permissions to candidate data.
   App data identity needs Blob Data Contributor on **only** `submissions`.
   Owner direct data access, if required, should be Blob Data Reader scoped to
   that container; download API access is otherwise checked by JWT.
4. Create single-tenant API/client app registrations in OUTLINERS, expose delegated
   `CV.Read`, configure the exact Owner/client IDs, MSAL authorization-code + PKCE
   sign-in, and request the `amr` optional claim. Verify an actual Owner token
   contains MFA evidence. If it does not, stop; never remove the MFA check.
   Security defaults are not proof of MFA for every application request. Any
   necessary Conditional Access licensing requires separate approval.
5. Deploy with all gates false, HTTPS only, no request-body/access-token logging,
   `FUNCTIONS_REQUEST_BODY_SIZE_LIMIT=7340032`, and exact CORS origins. Synthetic
   tests call the core or isolated test harness; do not enable live public POSTs.
6. Approve ACS/Email resources before creating them. An Azure-managed sender domain
   avoids changes to public DNS; a custom outliners.gr sender requires a separate
   DNS approval. Assign only the email-send role needed at the ACS resource.
   Configure `NOTIFY_EMAIL=info@outliners.gr`; verify synthetic delivery before
   enabling notifications. Outbox delivery/reconciliation is a remaining gate:
   email failure preserves the submission, but automatic durable email retries
   are not implemented by this change.
7. With forms still closed, validate synthetic upload/read/MFA/unauthorized denial,
   private-network access and failure recovery on Azure. Do not label local mocks
   as Azure E2E. Test lifecycle with synthetic expired metadata, not by waiting a year.
8. **Before any data intake**, replace/disable the existing 365-day lifecycle rule
   and enable the calendar-based timer. A fixed age lifecycle rule cannot express
   calendar months. Seven-day soft delete applies after timer deletion; physical
   cleanup is asynchronous. Failed deletions must alert and retry. Investigate any
   rollback-failed orphan and corrupt metadata using the private operator process.
9. CI + staging checks, privacy/consent review, explicit go-live approval. No merge
   to main or real public-form activation has been performed.

## Non-secret configuration (all live gates remain false)

```text
ENABLE_LIVE_FORMS=false
LIVE_FORMS_APPROVAL=
ENABLE_OWNER_DOWNLOAD=false
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_RETENTION_TIMER=false
RETENTION_MONTHS=12
NOTIFY_EMAIL=info@outliners.gr
STORAGE_ACCOUNT_URL=https://stoutlinerscv8dc62205.blob.core.windows.net
STORAGE_CONTAINER=submissions
OWNER_TENANT_ID=2e80c9c5-ca40-482a-8f9b-d73e9fa2c2bd
OWNER_OBJECT_ID=3a34bb0e-fea4-4ef3-b2be-a3e3826db9b0
OWNER_TOKEN_AUDIENCE=<registered-api-audience>
OWNER_CLIENT_ID=<approved-public-client-app-id>
ACS_ENDPOINT=<approved-resource-endpoint>
SENDER_EMAIL=<verified-azure-managed-sender>
FUNCTIONS_REQUEST_BODY_SIZE_LIMIT=7340032
```

Generate `IP_HASH_SALT` in Azure secret settings; never commit it. All app/identity
IDs must be reverified from the intended resource before granting any access.

## Primary documentation

- https://learn.microsoft.com/azure/azure-functions/flex-consumption-plan
- https://learn.microsoft.com/azure/azure-functions/configure-networking-how-to
- https://learn.microsoft.com/entra/identity-platform/optional-claims-reference
- https://learn.microsoft.com/entra/identity-platform/access-token-claims-reference
- https://learn.microsoft.com/javascript/api/@azure/communication-email/emailclient
