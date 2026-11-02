# OutLiners — GDPR and Azure backend readiness plan (DRAFT)

Decision recorded 2026-11-02: **proposed candidate CV retention = 12 months**, subject to documented purpose, lawful basis, transparency, and legal review. This is **not** a blanket rule for all personal data and is **not** approval to process live submissions.

## Retention design
- Candidate CV and candidate-submission metadata: proposed 12 months from receipt; calculate a per-record `deleteAfter` timestamp. Define whether a later candidate interaction creates a new retention event only after legal review; never silently reset the clock.
- Hiring requests/client contacts: separate purpose and retention decision **pending**.
- Technical logs, spam counters, email notices, backups, and deletion records: separate minimization/retention schedules **pending**.
- Candidate erasure requests: verify requester identity proportionately, delete earlier when applicable, including files and metadata; consider backups and any lawful exceptions.
- Azure Blob lifecycle policies are age-based; verify they cover **all** objects in each submission folder (CV and metadata), not merely a subset. Verify deletion timing and that a request for earlier erasure can be fulfilled independently of lifecycle.
- A scheduled deletion/lifecycle mechanism is required and must be tested with synthetic records before activation. `RETENTION_DAYS=730` is only a technical approximation of 12 calendar months; final implementation must choose and document exact calendar-month semantics and leap-day behavior.

## Legal and operational prerequisites (not yet satisfied)
1. Verify exact legal controller name, registered contact details, and privacy contact.
2. Determine lawful basis separately for responding to an application, future-opportunity talent pooling, and employer hiring requests. Do not presume that a checkbox alone establishes valid consent for every processing purpose.
3. Explain purpose, categories, recipients, storage location, retention, rights, and international transfers if any in both EN/EL privacy notices. Provide a clear, unbundled choice for future-opportunity retention if legal review requires it.
4. Confirm data-processing agreements, EU data residency and subprocessor terms for Azure, email and any future vendors.
5. **Owner decision:** only the OutLiners owner is authorized to access candidate CVs and submission records. Enforce a single named individual identity with MFA, least-privilege RBAC, audit logs and periodic access review. Azure platform/service identities may require narrowly scoped technical access; no clients, recruiters, or external collaborators receive data access. Document incident response and DSAR procedure.
6. Confirm info@outliners.gr can receive mail; verify sender/domain DNS only with owner authorization.
7. Assess whether a DPIA is required given actual processing scale, profiling and any special-category data inadvertently included in CVs.

## Proposed technical architecture — NO PROVISIONING AUTHORIZED
- Existing Azure Static Web Apps **Free** hosts static public pages; forms remain preview-only.
- Separate Azure Functions API: `/api/request-talent` and `/api/submit-cv`. Current Azure adapters are reference implementations and need live staging validation.
- EU Azure Blob Storage account/container with anonymous access disabled; encryption at rest; managed identity with minimum required permissions; no CV links in public pages or email. Only the owner has human read/download/delete access; use identity-based access, MFA and audit logging. No shared credentials.
- Outbound email notification to info@outliners.gr, containing minimal metadata only, never CV attachments.
- No public API, storage account, Function App, communication service, or paid SKU to be provisioned without separate owner approval.
- Before requesting approval, prepare a current-price estimate including storage transactions, Function execution and hosting, monitoring, email, and possible network egress; budget alerts are not spending caps.

## Safe staging sequence
1. Keep current site and forms unchanged.
2. Complete legal decisions and approve EN/EL wording.
3. Review current Azure pricing and exact resources with owner.
4. After explicit approval only, provision minimal EU test resources with cost controls and no public submissions.
5. Validate Azure adapters, identity and private access, limits, abuse prevention, deletion, retention and email using **synthetic** data.
6. Owner explicitly approves live form activation and DNS changes separately.

Status: planning document only. No Azure resources created; no form submissions activated; no DNS changes.

## Owner decision — simplest secure receipt workflow (2026-11-02)
- Send a minimal email notification to info@outliners.gr with candidate name, contact and submission ID; **no CV attachment**.
- The owner opens the CV from a secure owner-only authenticated view, preferably directly from the email notification, without needing to use Azure Portal.
- Implement and test this owner-facing retrieval flow before go-live; it does **not** yet exist in the reference backend. Do not put public or long-lived file URLs in email. Require MFA, short-lived authorization, audit logging and explicit deletion controls.
- Proposed candidate CV retention reduced from 24 to **12 calendar months**, subject to legal review and documented lawful basis. Keep other retention categories pending.
- No forms activation, paid provisioning, DNS changes or publication authorized by this decision.
