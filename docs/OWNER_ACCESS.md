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
- Cloud: registrations created successfully. Runtime deployment, actual Owner
  login/token MFA verification and synthetic CV download are pending at this
  checkpoint. Do not treat unit-token tests as real Entra sign-in evidence.
- If Entra requires admin consent or personal MFA interaction, pause that step
  for the Owner. Never weaken MFA or purchase Conditional Access licences to
  get a green test. A real non-Owner account test requires a separate authorised
  test identity; otherwise report its absence explicitly.

See `AZURE_BACKEND_STATUS.md` for the earlier storage/retention verification and
remaining email, operational and go-live gates. No merge or public DNS change.
