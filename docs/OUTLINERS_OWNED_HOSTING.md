# OUTLINERS-owned website — 4 November 2026 (Athens)

## Ownership and deployment

- Tenant OUTLINERS, existing subscription 8dc62205-4b91-4b6f-aede-40bc8ba1d217: Active/Enabled; signed-in operator has Owner role.
- New resource swa-outliners-website, reused rg-outliners-backend, SKU Free.
- Static assets are globally distributed. Regional SWA metadata/staging region East US 2: West Europe validation was rejected by Azure (RequestDisallowedByAzure, region not accepting new customers). Existing Functions, CV storage, Managed Identity, VNet and Private Endpoint stay in North Europe.
- URL: https://orange-coast-0f9760e0f.3.azurestaticapps.net/
- GitHub source: nppapadopoulos-jpg/outliners-website, codex/azure-private-backend, draft PR #11. No merge.
- Azure generated the dedicated workflow/secret. No secret values were read, printed, committed or copied between tenants.
- Dedicated workflow assembles only the public allowlist with production SEO/sitemap and all four forms preview=true. indexing.js sets noindex/nofollow/noarchive on the temporary Azure host; Analytics remains restricted to outliners.gr/www plus affirmative consent.
- Manual release workflow now targets the new OUTLINERS-specific deployment secret; its production approval and disabled-form defaults remain intact. It no longer targets the ATCOM resource.
- Original ATCOM Static Web App, DNS and Microsoft 365 services were not modified.

## Executed checks

- CI #174 passed for c7328159a330b47ffb0ec0e8a658d9a849659a87; subsequent workflow/report commits require their own CI result.
- Local smoke: 25 HTML pages. SEO audit passed: 24 public URLs, canonical/hreflang, descriptions, sitemap, OG, Organization, cookie settings and closed forms.
- Actual HTTP crawl of initial deployment: 24 public pages + 12 linked asset URLs, all HTTP 200.
- Missing page, /api/package.json, /docs/TALENT_DASHBOARD.md and /.git/config returned 404.
- Actual headers included CSP, DENY framing, nosniff, restricted permissions and referrer policy. Initial staging package had server-side noindex; final release candidate uses production robots/sitemap with temporary-host DOM noindex.
- Both live backend intake POSTs returned 503 forms-not-live with synthetic empty bodies.
- Actual browser Greek request-talent form with synthetic non-personal fields displayed the preview message confirming nothing was sent.
- Both Owner list and CV-download API returned 401 for anonymous and forged synthetic bearer tokens.
- Existing Owner Dashboard HTML returned 200. No new interactive Owner login/download was performed in this hosting change; prior signed-in MFA/download evidence remains in TALENT_DASHBOARD.md. Do not call the negative checks a new positive MFA test.
- Storage re-read: allowBlobPublicAccess=false, allowSharedKeyAccess=false, publicNetworkAccess=Disabled. No storage, Entra, MFA, IAM or private-network changes.
- Function flags re-read: ENABLE_LIVE_FORMS=false, ENABLE_OWNER_DOWNLOAD=true.
- Added only the exact new Azure website origin to existing Function App CORS. Existing origins preserved; no wildcard/credential access added. After propagation, new origin and outliners.gr returned their exact Access-Control-Allow-Origin with the expected closed-form 503. Untrusted origin received no CORS allowance.
- Consent banner reject/settings controls inspected. No Google tag loaded on the temporary host, even after consent, as intended. Real GA4 receipt and Search Console verification on the custom domain await DNS.

## ATCOM DNS handover — do not apply before coordinated cutover

These are NEW-resource tokens. Do not use prior victorious-cliff validation values.

| Stage | Type | Relative name | Value |
| --- | --- | --- | --- |
| Validate apex, separate TXT | TXT | @ | _e4garwdc1vgp6sc2ofz3140kvzdfcvi |
| Validate www without replacing its current CNAME | TXT | _dnsauth.www | _ur0wve8cas0ljqxwkcf8r80mj24i3ku |
| Route apex, only if DNS supports alias flattening | ALIAS/ANAME or CNAME flattening | @ | orange-coast-0f9760e0f.3.azurestaticapps.net |
| Route www | CNAME | www | orange-coast-0f9760e0f.3.azurestaticapps.net |

Azure currently shows the custom domains as Validating. No DNS or default-domain switch was made.
Azure explicitly reports that A records are unsupported on this new Static Web App; stableInboundIP is null. Never guess an IP by resolving its default hostname. Never add an ordinary apex CNAME: it conflicts with MX/TXT.

1. ATCOM confirms ALIAS/ANAME/flattening support on its authoritative ns1–ns4.atcom.gr. If unsupported, stop the apex cutover and coordinate an approved alternative; do not move nameservers or create paid DNS/CDN.
2. Snapshot existing web A/AAAA/CNAME and TTLs; current known web routing is A @ 188.34.135.14 and CNAME www outliners.gr (TTL 600). Re-read immediately before cutover.
3. Add the two TXT validation records separately; preserve the entire existing TXT set, especially SPF and Microsoft verification. Wait for Azure ownership validation.
4. After launch approval and TLS readiness, lower only web-record TTLs if needed, wait the old TTL, replace only apex web routing and www CNAME with the table targets, avoiding conflicting web records. Keep old hosting available.
5. Check apex/www HTTPS, redirects, 24 pages, policies, CSP, GA consent and still-closed forms. Coordinate final canonical-domain setting in the OUTLINERS resource only.
6. Rollback changes only the web records to their captured previous values. Validation TXT records do not route traffic.
7. MX (Proofpoint/Microsoft 365), SPF, DKIM selectors, DMARC, autodiscover, nameservers and every ATCOM mail setting stay unchanged. Do not infer mailbox validity from mail-delivery errors; email notifications are outside this change.

## Cost and boundaries

New SWA is Free: incremental Azure hosting/custom-domain/TLS cost zero within Free quotas. No Standard, Front Door, Azure DNS, extra Functions, Private Endpoint, storage or subscription upgrade created. Existing approved backend costs continue. Free has no production SLA and bandwidth limits; do not auto-upgrade.

No real submissions, DNS change, merge, ATCOM service write or email send was performed.
