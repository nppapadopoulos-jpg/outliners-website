# Owner CV access — Entra, MFA and private Blob downloads

> Current Dashboard implementation, verification and remaining launch gates: [TALENT_DASHBOARD.md](TALENT_DASHBOARD.md). Dated sections below are historical; their outstanding-item lists are superseded.

## Verified Azure result, 2026-11-03

The approved Owner completed personal Microsoft consent. The real same-origin
MSAL login succeeded and `/api/owner/session` accepted the actual Entra access
token. Its server-side RS256 validation required exact issuer, tenant, audience,
Owner object ID, approved client `azp`, delegated `CV.Read`, expiry and an `amr`
array containing `mfa`. No raw token or identity claims were printed or saved.
The API returns only `{owner:true,mfa:true}` after those checks.

An actual synthetic PDF was downloaded through `/api/owner/cv/{uuid}` from the
private Blob container. The browser received 670 bytes, beginning `%PDF-1.4`, with
SHA-256 `12725b6f86ebb7993f83bb9fd4abf160a6d01c71439ba4872f448cc86f3ef537`,
exactly matching the generated fixture. It contains only synthetic test text.
No public Blob URL, SAS token, browser storage credential or client secret was
used. Public forms remain disabled independently of Owner access.

The exact synthetic CV and metadata were then removed using the existing
maintenance function. The same authenticated Owner request subsequently returned
404 through the real API. Seven-day Blob soft-delete recovery still applies.
`ENABLE_OWNER_DOWNLOAD=true` remains restricted by all Owner/MFA checks;
`ENABLE_LIVE_FORMS=false` and email notifications remain disabled.

## Entra registration and client

Final Microsoft Graph verification confirmed that both client consent grants
(`CV.Read` and `openid profile offline_access`) are `Principal` grants restricted
to the configured Owner. The two broader `AllPrincipals` grants were replaced
with the same scopes for that Owner only; no other app grants were changed.

Two `AzureADMyOrg` registrations and their service principals exist in OUTLINERS:

- API app ID: `625d1f3e-a70f-44c2-996a-650e5b6ab0c2`
- Client app ID: `73ab66eb-f5e2-460b-966d-cfc6f2e212e1`
- Delegated scope: `api://625d1f3e-a70f-44c2-996a-650e5b6ab0c2/CV.Read`
- API token version 2; access-token optional `amr` requested.
- One SPA redirect: the existing Function App origin + `/api/owner/callback`.

The exact Owner object ID is configured only in Azure. API authorization uses no
email-address or display-name match and accepts no platform identity header as a
substitute for cryptographic verification. ID tokens, application tokens and
tokens for other clients cannot satisfy its delegated-token checks.

The console is at `/api/owner/console` on the existing Function App. MSAL Browser
5.27.0 is pinned in the lockfile and served on that origin, along with the MSAL v5
redirect bridge. Authorization Code + PKCE uses memory-only token caching and
Authorization headers. No CDN script, new hosting resource or paid licence was
introduced. The popup allows ten minutes for personal consent/MFA; this changes
no token lifetime or MFA requirement. Errors expose fixed allowlisted categories,
never provider error messages, SDK request/response objects, claims or tokens.

## Real tests and their limits

| Check | Evidence |
| --- | --- |
| Real Entra Owner and MFA | Session accepted after actual signature and claim checks |
| Real private CV download | Browser download, exact 670-byte PDF and matching SHA-256 |
| Anonymous download/session | Live HTTP 401 while Owner access enabled |
| Malformed/forged bearer | Live HTTP 401 |
| Forged token with expired claims | Live HTTP 401; this does not isolate expiry validation |
| Exact wrong Owner/tenant/audience/client, missing MFA/scope, expired and forged signatures | Signed synthetic-token tests in the 60-test backend suite |
| CV storage isolation | Public network Disabled, anonymous false, Shared Key false; one Approved Blob Private Endpoint |
| Forms | Both real intake POST endpoints remain closed |

A second real non-Owner identity and a validly signed Entra token without MFA
were not used. Those policy branches are covered by signed synthetic-token
tests, not separate real-user Entra sign-ins. No MFA check was bypassed.

## Conflict rollback fix

The download exercise found committed metadata whose CV file was missing. Code
review identified an unsafe rollback: an upload error could delete a previously
committed CV, and HTTP 409 conflicts were treated differently from 412. The
adapter now rolls back only a file successfully created by that particular
attempt and preserves files on either 409 or 412. Regression tests cover both
conflict statuses and a metadata conflict after creating a missing file. The
synthetic fixture was repaired, after which the actual Owner download succeeded.

This is not a complete orphan-reconciliation design for ambiguous transport
failures. Reconciliation remains a production-readiness item before live intake.

## Deployment and go-live boundaries

The tested functional code is PR #11 commit
`4739cd20811cf7dc2203ec0902a131081d647485`; CI #142 (`41705125998`) passed,
including all 60 backend tests, packaging, page smoke and UI regression checks.
Temporary fixture preparation used only the already existing maintenance timer
and Managed Identity, with one fixed synthetic UUID. No extra HTTP helper or
admin endpoint was created. Direct Cloud Shell Blob upload remained blocked by
the storage network policy; that policy was not relaxed.

The twelve-calendar-month retention function and seven-day soft-delete recovery
policy remain part of the existing architecture. A naturally scheduled hourly
execution still needs separate observation. ACS and durable retry were subsequently implemented; the actual recipient
mailbox hard-bounced the two synthetic notifications, so email remains paused.
See [email verification](EMAIL_NOTIFICATIONS.md). Distributed abuse controls,
orphan reconciliation and final production review remain gates. No public DNS change, form activation, unapproved resource/licence
creation or merge was performed.
