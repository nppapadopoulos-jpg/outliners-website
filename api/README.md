# OutLiners forms backend

Current implementation and verified cloud status: [Azure backend status](../docs/AZURE_BACKEND_STATUS.md).
The historical description below predates the private storage provisioning.
Use `npm ci --prefix api` before `node --test api/tests/*.test.mjs`.
Stage the complete backend with `node api/tools/package-azure.mjs /absolute/new/directory`;
do not deploy `api/azure` alone. No deployment command runs automatically.

Implements `docs/FORMS_BACKEND_CONTRACT.md` for the two intake workflows
(`/api/request-talent`, `/api/submit-cv`) as a **hosting-independent core**:
the handler takes a Web-standard `Request` and returns a `Response`, with all
side effects behind injected ports (storage, email, logger). Azure Functions,
the bundled Node server, or any fetch-capable runtime can host it unchanged.
The core and local adapters have **zero runtime dependencies**.

## What is TESTED here vs. what REQUIRES live infrastructure

| Layer | Status |
|---|---|
| `src/core/*` — validation, file magic-byte checks, spam/rate/duplicate controls, privacy logging, retention, notification composition, orchestration | **Fully tested** (39 `node:test` cases, in CI) |
| `src/adapters/local/*` + `local/server.js` — filesystem storage, email-to-file sink, standalone HTTP server | **Fully tested**, incl. real-HTTP E2E and a browser E2E that serializes the live bilingual forms |
| `src/adapters/azure/*` + `azure/` function app | **Reference implementations — NOT executed.** No Azure resources or credentials exist in this project; these must be validated in staging. No cloud or real-email test is claimed anywhere. |

The public website forms remain **preview-only** (`data-preview="true"`);
nothing on the site posts to this backend yet.

## Run locally

```bash
node api/local/server.js
```

Submissions land in `api/.data/submissions/` (git-ignored, mode 0600) and
notifications in `api/.data/outbox/` as JSON files — no email is ever sent.

## Tests

```bash
node --test api/tests/*.test.mjs
```

Covers: valid EN/EL submissions, per-field validation codes, consent,
header-injection neutralization, PDF/DOCX/DOC magic bytes, spoofed and
oversized files, honeypot, minimum form age, per-IP rate limiting, duplicate
suppression, storage and email failures, privacy-safe logging (asserts no
personal data in logs), retention flags, GDPR deletion, static contract
alignment with the real HTML forms, and HTTP-level E2E on the local server.

## Security model (summary)

Server-side validation only (client validation is UX); magic-byte +
extension agreement for files; 5 MB file / 7 MB request caps; filename
sanitization (no traversal, bounded charset); CR/LF stripped from all
single-line fields (email-header injection); plain-text notifications (no
HTML); per-IP salted-hash rate limiting; honeypot + minimum form age;
duplicate suppression; private storage only — notifications carry a storage
reference, never a link or attachment; structured logger that can only emit
an allow-listed set of metadata keys; env-based config with
`assertProductionConfig` refusing unsafe production settings; no secrets in
the repository.

## GDPR controls

Consent is required and recorded as an event with timestamp; control fields
are never stored (data minimization); retention is configurable and
**deliberately unset** until the owner/legal decision (records are flagged,
the purge tool refuses to run); `tools/delete-submission.mjs` performs
secure per-submission deletion for data-subject requests;
`tools/purge-expired.mjs` enforces retention on the local adapter (Azure
uses a Blob lifecycle rule). Open legal decisions are listed in
`docs/BACKEND_DEPLOYMENT.md`.
