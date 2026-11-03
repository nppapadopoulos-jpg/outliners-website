# Owner CV access — Entra and PKCE

## Configuration created in OUTLINERS, 2026-11-03

Two single-tenant (`AzureADMyOrg`) app registrations and their service principals
were created after confirming there were no existing OutLiners registrations.
No client secrets, paid licences, storage permissions for the browser client,
tenant-wide consent or new Azure hosting resources were created.

- API app ID: `625d1f3e-a70f-44c2-996a-650e5b6ab0c2`
- Client app ID: `73ab66eb-f5e2-460b-966d-cfc6f2e212e1`
- Delegated scope: `api://625d1f3e-a70f-44c2-996a-650e5b6ab0c2/CV.Read`
- API token version: 2, with optional access-token `amr` requested.
- SPA redirect: existing Function App origin + `/api/owner/callback` only.
- Implicit grant, fallback public-client flows and client secrets are not used.

The exact Owner object ID is configured in Azure, not supplied by the browser.
The API cryptographically checks RS256 signature/JWKS, exact v2 issuer, tenant,
audience, expiry, Owner `oid`, approved client `azp`, delegated `CV.Read`, and
`amr` containing `mfa`. Missing evidence fails closed. Platform identity headers,
ID tokens, application tokens and tokens for other clients are not accepted.
An MFA portal session is not proof that a separate API access token has MFA.

## Console implementation

The console is hosted on the existing Function App at `/api/owner/console`.
MSAL Browser 5.27.0 is pinned in the API lockfile and served from the installed
package on the same origin; no CDN script or new web hosting service is needed.
It uses authorization code + PKCE, a dedicated MSAL v5 redirect bridge and
memory-only token cache. Tokens are passed only in Authorization headers, never
query strings, console output, GitHub or error messages. Login errors are generic.
The server's `/api/owner/session` response returns only Owner/MFA success booleans
after real signature and claim checks. It never echoes tokens or identity claims.

Downloads stream bytes through `/api/owner/cv/{uuid}` with no-store/private and
attachment headers. There are no SAS links or browser Blob Storage credentials.
The browser creates only a short-lived local object URL for its download.
Static console/config routes expose no candidate data and cannot grant access.

`ENABLE_OWNER_DOWNLOAD` gates the console, session and download. Public intake is
independently gated and must remain disabled throughout this work. Setting the
Owner gate does not enable forms. Entra registration alone does not grant a user
successful CV access; all exact-identity and MFA checks still apply in the API.

## Verification status

- Local: 55 backend tests passed, including signed synthetic tokens rejecting
  wrong Owner, tenant, audience, issuer, client, missing scope/MFA, wrong token
  version, expired and forged tokens. The 25-page smoke suite passed.
- Cloud: registrations were created successfully. Commit
  `e446a34114bbeeaac2f6ca3995903f1a8cefa90f` was deployed to the existing Function
  App with both Owner and public-form gates verified disabled. Azure CLI reported
  successful deployment; external HTTP checks returned console JS 200 and Owner
  config/session/download plus both public forms 503. MSAL and redirect-bridge
  assets also returned 200. Exact tenant/audience/client/Owner IDs are configured
  in Azure with `ENABLE_OWNER_DOWNLOAD=false`.
- CI run #128 (`41693955532`) passed for the deployed code commit.
- The Owner subsequently explicitly approved temporary activation for testing.
  `ENABLE_OWNER_DOWNLOAD=true` was applied and the app restarted. The real console
  opened a tenant-specific MSAL v2 authorization request using PKCE S256 and an
  essential `amr=mfa` claims request.
- The secure saved-account selection returned `submission_failed` after about
  233 seconds; the popup had closed and the console denied access. No real access
  token or MFA claim was inspected, displayed or logged. Its issuance/claims are
  unknown. This is not evidence that Entra omitted MFA.
- Investigation found MSAL's configured default popup bridge wait is only 60
  seconds. A timeout is a plausible cause, not a proven provider failure. The
  console now allows ten minutes for personal account/MFA interaction and shows
  only a fixed safe timeout message. Token lifetimes and MFA validation are
  unchanged. A new personal sign-in attempt is required.
- Actual HTTP checks while the Owner gate was enabled: anonymous download 401,
  malformed bearer 401, forged synthetic token with expired claims 401, anonymous
  session 401; both public forms 503. The forged expired-token test does not
  isolate expiry validation; signed unit tests cover expiry and missing MFA.
- Azure management checks confirmed CV storage public network Disabled,
  anonymous access false and Shared Key false. No new CV was uploaded because
  real Owner authentication did not complete.
- Owner access was reset to `false` and the app restarted. Successful real Owner
  MFA-token verification and synthetic CV download remain pending. Real
  non-Owner and validly signed Entra tokens without MFA have not been exercised;
  equivalent claim restrictions passed the signed synthetic unit-token suite.
- If Entra requires admin consent or personal MFA interaction, pause that step
  for the Owner. Never weaken MFA or purchase Conditional Access licences to
  get a green test. A real non-Owner account test requires a separate authorised
  test identity; otherwise report its absence explicitly.

See `AZURE_BACKEND_STATUS.md` for the earlier storage/retention verification and
remaining email, operational and go-live gates. No merge or public DNS change.
