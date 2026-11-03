# Final release plan and rollback — 4 November 2026

## Current boundaries

No merge, deployment, real intake activation, email send, new resource, DNS or
ATCOM email change is authorized in this preparation. Existing approved Azure
cost estimate remains usage-based; no new billable service is proposed.

Actual read-only check: outliners.gr and www.outliners.gr resolve to 188.34.135.14
and respond HTTP 200 with Microsoft-IIS/10.0 and title "Outliners - Under Construction". They are not currently the existing
Azure Static Web App hostname. The last successful Azure staging workflow used
https://victorious-cliff-0a3a2b403.6.azurestaticapps.net (ATCOM subscription per
existing project records), verified HTTP 200 with X-Robots-Tag noindex/nofollow/noarchive; current OUTLINERS subscription contains the backend,
not that Static Web App. Do not create a replacement.

## Preparation complete in source

- EL/EN privacy/cookie pages and footer settings; registered controller identity.
- Basic consent: no Google tag/ping before opt-in; revocation disables/clears/reloads;
  only safe public page metadata and two allowlisted success events.
- Real GA4 stream ID intentionally blank in assets/js/site-config.js. No mock ID
  is deployed. Conversion integration tests stub both Google and Azure.
- Unique titles/descriptions, canonical/hreflang, 24-URL production sitemap,
  Organization data, self-hosted fonts and editorial image alternatives.
- tools/build-static.mjs staging|production /absolute/new/directory assembles only
  public files with security headers and a real 404 response configuration.
  Staging has X-Robots-Tag noindex and restrictive robots; production uses the
  production sitemap/robots. Host-aware meta noindex also covers temporary mirrors.
- Manual-only existing Azure workflow supports staging/production with explicit
  production acknowledgement; merge alone cannot deploy. A real GA4 ID is required
  by the production preflight. The existing deployment secret is reused.
- Four checked-in forms remain preview=true. Real HTML is generated only by an
  explicitly approved production run with enable_forms=true; backend gate is separate.

## Owner/Google steps (no secret credentials in chat)

1. In the chosen Google account, use standard free GA4, web stream https://outliners.gr,
   timezone Europe/Athens. Disable Enhanced Measurement (particularly form capture),
   Google Signals, advertising personalization, user-provided data and optional data
   sharing; choose two-month event retention without reset on new activity. No Ads,
   BigQuery paid export, User-ID or advertising trackers. Accept/review processing terms.
2. Supply the public G-... Measurement ID. Set it in the one site-config file and run CI.
   Mark submit_cv_success and request_talent_success as key events in GA4; create
   definitions if needed. Counts cover consenting visitors, not all submissions.
3. Search Console: use URL-prefix https://outliners.gr/ and its generated HTML file
   or meta verification token, avoiding DNS changes. Do not invent a token. Publish
   the exact supplied verification file/tag with the approved release, then Verify
   and submit https://outliners.gr/sitemap.xml. Domain property requires separately
   approved DNS TXT if the Owner chooses it instead. Link GA4/Search Console only
   after the chosen account has both required property permissions.
4. Google Business Profile: public search did not establish a matching profile.
   Absence is not proven. Check Owner account first; never duplicate. Eligibility
   requires actual in-person customer contact. The registered address is not claimed
   to be an eligible public-facing office. Prepare name OUTLINERS, website and the
   verified contact details; choose a recruitment/employment-agency category offered
   by Google only if applicable. No listing/address publication without confirmation.

## Exact approved launch sequence (not executed)

1. Complete privacy sign-off in LEGAL_PRIVACY_REVIEW.md and the Google configuration.
   Review latest green CI. Record approved source SHA and keep prior approved static
   bundle/backend ZIP for rollback. Recheck Azure flags and existing target resources.
2. Obtain explicit approval for PR #11 merge, backend/static deployment and real intake.
   PR #11 currently targets feature/story-captions-email, not main; do not silently
   retarget it or merge into main. Merge only the reviewed approved target.
3. Deploy the new backend package first with ENABLE_LIVE_FORMS=false and email=false.
   Use existing api/tools/package-azure.mjs, npm ci and existing Function App ZIP
   deployment; no app registration, permissions, storage or network changes.
4. Validate the new Owner erasure and purpose-specific retention with a scoped
   synthetic fixture, including actual metadata/file deletion and cleanup. These
   additions have automated adapter tests; they are not yet deployed/tested in Azure.
5. With specific approval, connect ONLY web-domain records/custom-domain binding
   to the existing Free SWA, preserving MX/SPF/DKIM/DMARC and ATCOM email. First read
   the SWA custom-domain wizard's exact target/validation instructions; do not guess
   an apex record. Alternatively use the present IIS hosting if Owner provides its
   authorized deployment access. Public DNS remains unchanged until that decision.
6. Run the manual static workflow in production mode at the approved commit, with
   explicit acknowledgement. Verify TLS, apex/www redirect/canonical choice, 200s,
   true 404, CSP/security headers, production robots/sitemap and noindex removal only
   on the intended public domain. Preview mirrors stay noindex. Cookie rejection
   must still allow navigation/forms. No private API route is hosted in the static bundle.
7. After backend/public-host checks pass and explicit activation approval, set the
   backend intake gate true, keep email=false and publish enable_forms=true. Verify
   exact production CORS origins. Perform one controlled synthetic CV + client HTTP
   submission, Owner display/download/hash and cleanup. Then validate real GA4
   receipt/key events with consent and absence without it. Do not count fixture IDs
   or form data in Analytics. Validate Search Console's live URL and submit sitemap.
8. Observe the next naturally scheduled retention cycle and errors, check Dashboard
   from desktop and mobile (Owner already reported existing mobile version works).
   No email delivery is needed for the workflow.

## Fast rollback

Immediately close ENABLE_LIVE_FORMS first (output suppressed when updating settings)
if storage/auth/privacy checks fail. Keep email=false. Publish the approved static
bundle with preview forms; restore the previous tested backend ZIP if necessary.
Do not delete committed CVs or change storage/network permissions as a rollback.
Owner access can remain only if its security is verified. Preserve privacy-safe
operational evidence; never log tokens or candidate content. Stop Google collection
by blanking the ID/releasing consent-disabled configuration if its setup is wrong.
DNS rollback, if required after an approved DNS change, needs its own exact approved
record set; no mail records are part of this plan.
