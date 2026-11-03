# OutLiners final launch gates — 4 November 2026

See [GO_LIVE_RUNBOOK.md](GO_LIVE_RUNBOOK.md) for release order and rollback,
[LEGAL_PRIVACY_REVIEW.md](LEGAL_PRIVACY_REVIEW.md) for final privacy review and
[TALENT_DASHBOARD.md](TALENT_DASHBOARD.md) for the earlier real Azure tests.

Prepared, not published: bilingual privacy/cookies, consent-gated GA4 integration,
24-URL SEO/canonical/sitemap, safe public bundle, purpose-specific CV retention,
and Owner early-erasure control. Email remains paused and optional.

## Actual remaining dependencies

- Owner/legal privacy sign-off, actual provider/account terms, and real Google GA4
  Measurement ID + consented provider receipt check (test loader/API are mocked in CI).
- Search Console account verification token/file; sitemap and URL-prefix path prepared.
- Main domain currently serves an IIS Under Construction page, while Azure staging
  uses the existing Free SWA. Approve the exact web-domain binding/DNS plan, or provide
  authorized current-host deployment access. No mail/DNS change has been made.
- Explicit approval for PR merge, coordinated backend/static deployment and real forms.
  New purpose/early-erasure code needs its scoped synthetic Azure test after approved
  backend deployment; it must not be claimed as deployed in the preparation report.

Source and real Azure test results are distinct. No guarantee of indexing, ranking,
physical legal compliance or field Core Web Vitals is made by a green CI score.
