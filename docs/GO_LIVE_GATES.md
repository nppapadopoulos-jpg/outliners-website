# OutLiners launch gates

Preparation only. Forms stay disabled. No DNS changes or new cloud resources.

## Ready in source
- Form validation and local adapters
- Proposed 12-calendar-month deadline calculation
- Owner download authorization core
- Dry-run-first expiry purge core

## Must complete before activation
- Bind owner download to verified MFA identity. Never trust a caller-supplied principal ID.
- Connect the owner download to private Azure Blob storage and test against synthetic files.
- Schedule deletion for both CV files and metadata, and test failure recovery.
- Test complete end-to-end flow, including email notification failures.
- Verify mailbox info@outliners.gr and sender identity.
- Finalize privacy notice and lawful basis with legal review.
- Obtain explicit owner approval for cloud cost and form activation.

Never include CV attachments, public blob links, SAS tokens, or secrets in notification emails.
