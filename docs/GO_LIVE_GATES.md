# OutLiners launch gates

Current evidence and limits: [Talent Dashboard verification](TALENT_DASHBOARD.md).

## Completed

- Actual Owner Entra/MFA, private Blob list/details/review/download and PDF preview.
- Synthetic Azure storage workflow, pagination/search/filters.
- Durable admission/idempotency, email failure without loss, expiry/orphan recovery.
- 80 backend tests and full CI #152 passed for deployed functional source.
- Forms closed, no merge, public DNS change or new paid resource.

## Final requirements

- Complete and approve draft privacy notice with verified controller legal identity.
- Explicit Owner approval for PR merge/static publication and real form activation.
- At activation, verify existing public hosting/domain route and controlled public-origin submission; no DNS change authorized.
- Owner mobile-device smoke test before relying on mobile access.

Email is optional and paused. Its failure must never undo committed submissions.
Never include CV attachments, personal details, public Blob links, SAS tokens or
secrets in notifications.
