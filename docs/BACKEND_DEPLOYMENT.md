# Forms backend — deployment guide

Status: code complete and locally tested (see `api/README.md` for the honest
tested-vs-untested breakdown). **Nothing is deployed; no cloud resources,
DNS or email configuration exist.** This document is the runbook for when the
owner confirms hosting.

## 1. Required hosting capabilities

Any host must provide: static file serving for the site; a Node 20+ runtime
reachable at `/api/request-talent` and `/api/submit-cv` on the same origin;
private (non-web-served) file storage in the EU; outbound email via a
provider API or SMTP; environment variables/secrets management; HTTPS;
access logging without body capture.

## 2. Environment variables (no secrets in the repo)

| Variable | Required | Notes |
|---|---|---|
| `NOTIFY_EMAIL` | prod | `info@outliners.gr` — **mailbox existence unconfirmed; owner must create/verify it** |
| `SENDER_EMAIL` | prod | provider-verified sender, e.g. `no-reply@outliners.gr` (needs SPF/DKIM on the domain) |
| `IP_HASH_SALT` | prod | long random string; production refuses the dev default |
| `RETENTION_DAYS` | prod | **owner/legal decision — production refuses to start unset** |
| `MAX_FILE_BYTES`, `MAX_REQUEST_BYTES`, `MIN_FORM_AGE_MS`, `RATE_LIMIT_PER_HOUR`, `DUPLICATE_WINDOW_MS` | no | tuned defaults in `api/src/core/config.js` |
| Azure only: `STORAGE_ACCOUNT_URL`, `STORAGE_CONTAINER`, `ACS_CONNECTION_STRING` (or managed identity) | prod | see `api/azure/README.md` |
| Self-hosted only: `STORAGE_DIR`, `EMAIL_SINK_DIR`→ replaced by an SMTP adapter | prod | storage dir outside the web root, mode 0700 |

## 3. Preferred architecture — Azure (reference, not yet provisioned)

```
Browser ── HTTPS ──> Azure Static Web Apps (site, EU)
                        └─ /api/* ──> Azure Functions (Node 20, consumption)
                                         ├─> Blob Storage container "submissions"
                                         │     • region: westeurope (EU)
                                         │     • no anonymous access
                                         │     • lifecycle rule: delete after RETENTION_DAYS
                                         │     • access: managed identity (Functions) + RBAC (staff)
                                         └─> Azure Communication Services — Email
                                               • verified sender domain outliners.gr
                                               • plain-text notification to info@outliners.gr
```

Azure-specific dependencies are isolated to `api/src/adapters/azure/` and
`api/azure/` (reference implementations, unvalidated — no resources exist).
Everything else is platform-neutral.

## 4. Alternative deployment path (if another host is chosen)

`api/local/server.js` is a production-shaped standalone Node server using the
same core. On any VPS/container host (incl. a Greek hosting provider that
offers Node):

1. Run it under systemd/PM2 behind the web server (nginx/Caddy) with
   `location /api/ { proxy_pass http://127.0.0.1:8787; }`.
2. Point `STORAGE_DIR` at a directory **outside the web root** (mode 0700),
   on an encrypted EU-located disk; schedule `api/tools/purge-expired.mjs`
   daily via cron for retention.
3. Replace the email sink with an SMTP/API adapter for the chosen mailbox
   provider (the port is one `send(message)` function; ~30 lines).
4. Add basic rate limiting at the proxy as a second layer.

Compatibility assessment: any host that can run Node 20 and keep a private
directory qualifies; plain shared PHP hosting does **not** (no Node) — in
that case Azure (or any functions provider) remains necessary for the API
even if the static site stays where it is, with CORS added accordingly.

## 5. Email provider requirements

- Sender domain `outliners.gr` verified with SPF + DKIM (and DMARC
  recommended) — DNS changes require owner approval.
- The `info@outliners.gr` mailbox must exist (currently unconfirmed).
- Plain-text sending with Reply-To support; ~tens of messages/month.
- Candidates/companies receive no email in v1 (notification-only design).

## 6. Storage requirements

EU region; private/no public access; per-submission folder layout
`submissions/<form>/<yyyy-mm>/<uuid>/`; ~1 MB average per submission →
even 1 000 submissions/year ≈ 1 GB — negligible. Access restricted to the
function identity plus named staff (RBAC / filesystem permissions).

## 7. Estimated monthly cost (assumptions: ≤500 visits/day, ≤100 submissions/month)

| Item | Azure (preferred) | Self-hosted alternative |
|---|---|---|
| Static hosting | SWA Free tier €0 (Standard €8–9 if chosen) | included in VPS |
| Functions | Consumption: effectively €0 at this volume | — |
| Storage | Blob < €1 | included |
| Email | ACS: < €1 at this volume | SMTP provider €0–10 |
| VPS | — | €5–12 |
| **Total** | **≈ €0–11 / month** | **≈ €5–22 / month** |

Domain/registrar fees excluded. Assumptions stated; real quotas to be
confirmed at provisioning.

## 8. Production security checklist

- [ ] `IP_HASH_SALT` set to a long random value (prod refuses default)
- [ ] `RETENTION_DAYS` set after owner/legal decision (prod refuses unset)
- [ ] Storage private: no anonymous access / outside web root, verified by probe
- [ ] Managed identity or least-privilege credentials; no connection strings in code
- [ ] HTTPS only; HSTS, X-Content-Type-Options, CSP on the site
- [ ] Sender domain SPF/DKIM verified; test notification received at info@
- [ ] Rate limits verified against the deployed endpoint
- [ ] Logs inspected: metadata only, hashed IPs, no personal data
- [ ] Staff access list for the submissions store documented
- [ ] `data-preview` removal + frontend fetch wiring (contract §6) only after all above

## 9. GDPR decisions still required (owner/legal — not invented here)

1. Retention period for candidate CVs and for hiring requests (may differ).
2. Final privacy policy text and the forms' consent wording (drafts are
   marked on the site).
3. Legal basis mapping and controller details (registered entity, address).
4. Whether candidates receive a confirmation email (changes data flows).
5. Staff access list and the process for data-subject requests
   (the deletion tooling exists; the procedure owner must be named).

## 10. Staging and go-live plan

1. **Owner confirms hosting** (Azure vs. alternative) and creates
   `info@outliners.gr`.
2. **Staging**: provision isolated resources (or a staging VPS), deploy the
   site + API, set env vars, run the full test suite against staging URLs,
   send a staging notification to a test mailbox, validate the two Azure
   adapters (their first real execution), verify private-storage probes.
3. **Legal**: finalize privacy/cookie text and consent wording; set
   `RETENTION_DAYS`; configure the lifecycle rule/cron.
4. **Activate forms** per contract §6 (remove `data-preview`, add the fetch
   + bilingual success/failure messages — owner approves the copy).
5. **Pre-launch QA**: repeat smoke/UI/axe suites + an end-to-end submission
   on staging; verify the notification arrives at `info@outliners.gr`.
6. **Go-live**: DNS cut-over (owner approval), production env vars, first
   real submission test, monitor logs for 48 h.
7. **Post-launch**: confirm purge/lifecycle executes; document the
   data-subject-request procedure.
