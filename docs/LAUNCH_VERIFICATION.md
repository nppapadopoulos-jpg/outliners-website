# Release preparation verification — 4 November 2026 (Athens)

This is a source/readiness report, not a production deployment report.

## Automated checks executed

- 84 backend tests pass: signed identity/MFA negatives, private storage, admission,
  recovery, purpose-specific consent/retention and Owner early erasure/ETag/retry.
- Page smoke: 25 HTML pages. SEO audit: 24 indexable production URLs, distinct
  titles/descriptions, exact canonical/hreflang/sitemap, Open Graph, Organization,
  resolvable links/assets, footer cookie controls, all four forms still preview=true.
- Public-only staging and production packages assembled; backend package assembled.
  No build command deploys. Workflow YAML parsed and diff whitespace checked.
- npm audit of production API dependencies reported zero known vulnerabilities
  (info/low/moderate/high/critical all zero). This is a registry snapshot, not a
  guarantee of absence of vulnerabilities.
- GitHub CI #158 (41740490336) and #160 (41741933912) passed backend/package, smoke,
  axe accessibility, navigation/overflow at desktop/tablet/mobile widths, and
  synthetic consent/conversion integration. Final PR head must also pass CI.
- Consent integration intercepts all external requests: Google loader and Azure
  responses are synthetic. It verifies no pre-consent requests/cookies, reject
  without blocking intake, footer settings, revocation/cookie removal, safe event
  payloads, no retroactive/duplicate/preview/failed conversions, and both success
  event names in EL/EN. It does not claim real GA4 account receipt.
- Initial Lighthouse default mobile runs varied substantially on shared CI:
  EN performance 90 then 64; EL 100; SEO/accessibility/best-practices 100. Raw
  reports show main-thread variability. The final workflow records three runs
  per language and their median, preserving every report for inspection. Do not
  cherry-pick one score or label lab results as field Core Web Vitals.

## Actual live Azure checks in this preparation

- Existing OUTLINERS tenant/subscription and Function App reused, with no writes
  to app configuration, identity, storage permissions, networking or resources.
- CV storage North Europe: public network Disabled, anonymous/Shared Key false;
  exactly one Private Endpoint.
- Flags re-read: live forms false, email false, Owner true, retention timer true,
  RETENTION_MONTHS=12, no temporary test-phase setting.
- Anonymous Owner list returned 401; CV and client intake POSTs returned 503.
- Actual Owner logged in again using Microsoft/Entra; existing API verified MFA.
  Fifteen-minute idle logout was observed. No token/credential was displayed or
  saved. Existing synthetic list/preview/download/hash and storage recovery results
  are documented in TALENT_DASHBOARD.md; they were not falsely repeated here.
- Current domain outliners.gr/www: DNS 188.34.135.14, HTTP 200, IIS, "Outliners -
  Under Construction". Existing Azure preview: HTTP 200, noindex/nofollow/noarchive.
  No DNS or ATCOM email change was made.

## Visual and account limits

Consent banner, reject/settings and Greek cookie policy were inspected in the
managed preview. CI covers representative desktop/tablet/mobile widths and axe.
Owner already reported the existing Dashboard works on mobile. New Owner erasure
and three-month specific-role retention are tested in source only and need their
scoped real Azure test after approved deployment; no production write was made
merely to claim that test passed.

GA4 Measurement ID/account settings and Search Console verification have not been
provided/authorized for setup. Real GA4 receipt, Search Console indexing status
and property linking are therefore pending. Public search did not establish a
matching Google Business Profile; no duplicate or unverified office listing was
created. Eligibility/address and Owner-account check remain optional follow-up,
not a reason to publish an unsupported Maps address.

## Final dependencies

See LEGAL_PRIVACY_REVIEW.md for the short legal/account sign-off, GO_LIVE_GATES.md
for blockers, and GO_LIVE_RUNBOOK.md for exact coordinated release/rollback order.
No merge, public publication, real submission activation, paid service or DNS
change was performed. Email is not a prerequisite for launch.
