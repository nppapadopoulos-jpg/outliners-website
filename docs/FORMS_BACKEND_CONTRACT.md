# OutLiners intake forms — backend integration contract (v1.0)

Status: **implemented** in `api/` (hosting-independent core, locally tested —
see `api/README.md`) but **not deployed**; deployment runbook in
`docs/BACKEND_DEPLOYMENT.md`. The forms on
`/request-talent/` and `/submit-cv/` (and their `/el/` counterparts) are live in
**preview mode**: `assets/js/intake.js` always prevents submission while the
form carries `data-preview="true"`, so no data leaves the visitor's browser.

This document is the single source of truth for the future backend. The
frontend field names, limits and endpoints below are already final in the
markup — implement the backend against them, then remove `data-preview` and add
the `fetch` submission described in §6.

## 1. Target architecture (owner-approved direction, pending final sign-off)

- **Azure Static Web Apps** serving this repository's static files.
- **Azure Functions** (SWA managed functions or a linked Function App) exposing
  the two endpoints under `/api/`.
- **Azure Blob Storage, EU region** (e.g. `westeurope`), **private container**
  (no anonymous access) for uploaded files and submission records. Public
  directories must never hold CVs.
- **Notification email** to `info@outliners.gr` (confirm the mailbox exists
  before go-live) via Azure Communication Services Email or the company's SMTP.
  The notification contains submission metadata and a **secure link** to the
  stored file — never the CV as an attachment.
- No credentials or connection strings in this repository: use SWA/Function
  App application settings and managed identity for Blob access.

## 2. Endpoints

| Form | Method | Path | Content type |
|---|---|---|---|
| Request Talent | POST | `/api/request-talent` | `multipart/form-data` |
| Submit CV | POST | `/api/submit-cv` | `multipart/form-data` |

## 3. Fields

Common to both forms:

| Name | Type | Required | Notes |
|---|---|---|---|
| `full_name` | text | yes | |
| `email` | email | yes | validate format server-side |
| `phone` | text | RT: no / CV: yes | |
| `consent` | `"yes"` | yes | privacy-notice acknowledgement, not blanket processing consent; persist version/time privately |
| `lang` | `"en"` or `"el"` | yes | language of the page used |
| `website` | text | — | **honeypot**: any non-empty value ⇒ silently accept and discard (HTTP 200, no storage, no email) |
| `form_started_at` | epoch ms | yes | **time check**: reject if `now - value < 3000` ms or value missing/not numeric |

`/api/request-talent` additionally:

| Name | Type | Required |
|---|---|---|
| `company` | text | yes |
| `job_title` | text | yes |
| `location` | text | yes |
| `employment_type` | enum: `full-time`, `part-time`, `contract-interim`, `executive`, `other` | yes |
| `timeline` | enum: `asap`, `1-month`, `1-3-months`, `3-plus-months`, `exploring` | yes |
| `salary_range` | text | no |
| `job_description` | text ≤ 5000 chars | yes |
| `attachment` | file | no |

`/api/submit-cv` additionally:

| Name | Type | Required |
|---|---|---|
| `specialization` | text | yes |
| `preferred_location` | text | yes |
| `position_reference` | text ≤ 200 chars | required if no future opt-in |
| `talent_pool_consent` | `"yes"` only if deliberately checked | optional for a named role |
| `linkedin` | URL (`https://…`) | no |
| `introduction` | text ≤ 1500 chars | no |
| `cv` | file | **yes** |

## 4. File rules (both endpoints)

- Max size: **5 MB** (5 242 880 bytes). Reject larger with `413`/`422`.
- Allowed: PDF (`%PDF` magic bytes), DOCX (ZIP magic bytes + `[Content_Types].xml`),
  legacy DOC (OLE magic bytes). **Verify magic bytes server-side** — never trust
  extension or `Content-Type` alone.
- Store at `submissions/{form}/{yyyy-mm}/{uuid}/{original-name-sanitized}` in the
  private container; alongside it store `submission.json` with all fields, the
  notice acknowledgement/version, separate pool consent/purpose, language, and receipt time (for future ATS/CRM import).
- Do **not** log file contents; log only metadata (sizes, outcome, hashed IP).

## 5. Responses (JSON)

| Case | Status | Body |
|---|---|---|
| Accepted | 200 | `{"ok": true}` |
| Validation failure | 422 | `{"ok": false, "errors": {"field": "code"}}` |
| Too large | 413 | `{"ok": false, "errors": {"file": "too-large"}}` |
| Rate limited | 429 | `{"ok": false, "retry": true}` |
| Honeypot triggered | 200 | `{"ok": true}` (discard silently) |

Rate limit: suggest 5 submissions / hour / IP per endpoint.

## 6. Activation

See [GO_LIVE_RUNBOOK.md](GO_LIVE_RUNBOOK.md). No activation is authorized by this contract.
The prepared frontend requires an explicit data-preview="false" generated release;
the Azure gate is independent. GA4 success is dispatched only for a confirmed stored
response with an ID and not duplicate=true; no form fields or IDs enter its event payload.

Specific-opportunity-only CVs expire within three calendar months; optional future
pooling within twelve. Owner erasure moves the deadline to now and the existing
hourly timer removes the whole prefix with retry. All four checked-in forms stay closed.
