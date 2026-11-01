# OutLiners intake forms — backend integration contract (v1.0)

Status: agreed frontend contract, backend **not yet implemented**. The forms on
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
| `consent` | `"yes"` | yes | reject any submission without it; log timestamp |
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
  consent timestamp, language, and receipt time (for future ATS/CRM import).
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

## 6. Frontend activation (when backend is live)

1. Remove `data-preview="true"` from both forms (all four pages).
2. In `assets/js/intake.js`, replace the preview branch with:
   `fetch(form.action, { method: "POST", body: new FormData(form) })`,
   showing a bilingual success or failure message in the existing
   `.form-status` box (success copy to be approved by the owner).
3. Update `/privacy-policy/` + `/el/privacy-policy/` with the final, legally
   reviewed text covering these forms (purpose, legal basis, retention,
   processors, rights) **before** enabling submissions.
4. Confirm `info@outliners.gr` exists and SPF/DKIM are set for the sending
   domain.

## 7. GDPR requirements for the backend

- EU-region storage and processing only; no third-party form processors.
- Retention: auto-delete submissions after the owner-approved period
  (lifecycle rule on the container); period to be fixed with legal review.
- Access to the container restricted (managed identity / RBAC); notification
  emails carry links that require authentication, not public SAS URLs with
  long expiry (if SAS is used, expiry ≤ 7 days and scope read-only).
- A data-subject deletion request must be executable by deleting the
  submission folder (one UUID = one submission).

## 8. ATS/CRM readiness

Each submission's `submission.json` is the integration record. A future ATS or
CRM connector consumes new records via Event Grid (blob-created events) or a
scheduled import — no frontend changes required.
