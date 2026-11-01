# OutLiners website

Bilingual (EN/EL) static website for **OutLiners — Boutique Recruitment & Talent Advisory**, built from `docs/WEBSITE_MASTER_BRIEF.md`. It is **not deployed** to outliners.gr.

## Structure

```
index.html                                  Home (English)
services/ , industries/ , about/ ,
contact/ , privacy-policy/ , cookies/       English pages
request-talent/ , submit-cv/               Bilingual intake forms (preview mode —
                                            see docs/FORMS_BACKEND_CONTRACT.md)
el/…                                        Greek mirror of every page (crawlable
                                            /el/ URLs, hreflang-linked both ways)
404.html                                    Not-found page (bilingual, noindex)
assets/css/styles.css                       Design system (monochrome, tokens, responsive)
assets/js/main.js                           Mobile nav, reveal animation, year
assets/fonts/InterVariable.woff2            Self-hosted Inter (OFL, license alongside)
assets/img/                                 Authentic logo (black/white), symbol, OG image
sitemap.xml                                 Both languages with xhtml hreflang alternates
robots.txt , favicon.png
tests/smoke_test.py                         CI smoke tests (links, structure, hreflang)
.github/workflows/ci.yml                    Runs the smoke tests on push/PR
docs/screenshots/                           Desktop + mobile, EN + EL
```

No build step, no dependencies, no trackers, no cookies — the site stores nothing in the browser. Each page exists in exactly one language; the ΕΛ/EN control in the header is a plain link to the same page in the other language.

## Local preview

Pages use root-relative URLs, so preview with a local server rather than `file://`:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> (English) or <http://localhost:8000/el/> (Greek).

## Tests

```bash
python3 tests/smoke_test.py
```

Checks every page for broken internal links, missing titles/descriptions, heading structure, `lang`/hreflang correctness, canonical URLs, image alt text, presence of the authentic logo, complete main navigation, and that the EN/EL language switch on every page links to its exact counterpart. GitHub Actions runs the same script on every push and pull request.

## Brand

The site uses the **authentic OutLiners logo** supplied by the owner as transparent PNGs:

- `assets/img/logo-white.png` — used on dark surfaces (header, footer, OG image)
- `assets/img/logo-black.png` — for light surfaces and print
- `assets/img/symbol-white.png` / `symbol-black.png` — the square symbol alone, extracted losslessly from the supplied artwork; source of `favicon.png` and `apple-touch-icon.png`

Proportions, typography and the square symbol are untouched — the files are trimmed crops of the owner's artwork, never redrawn. If an original vector (SVG/PDF) master becomes available, swap it in for crisper rendering at large sizes; raster PNGs at this resolution (1236×176) are sharp at all current usages.

## Intake forms (preview mode)

`/request-talent/` and `/submit-cv/` (plus `/el/` counterparts) carry complete,
validated form UIs that are **deliberately not wired to anything**: submission
is blocked in `assets/js/intake.js` while the forms carry `data-preview="true"`,
and a visible notice says so. No data leaves the visitor's browser. The full
backend specification — Azure Functions endpoints, field contract, file rules,
spam controls, EU-region private storage, notification to `info@outliners.gr`,
GDPR and ATS/CRM readiness — lives in `docs/FORMS_BACKEND_CONTRACT.md`.
Consent wording on the forms is a clearly-marked draft pending legal review.

## Deliberately not included yet (pending owner decisions)

- **Contact form** — waiting on email provider choice; spam protection and privacy disclosure come with it.
- **Public pricing** for Embedded Talent Partner — pages say "Request a tailored proposal" per the brief.
- **Final legal text** — privacy/cookies pages are clearly-marked drafts; do not invent policy text. Hosting server logs/cookies must be documented once the provider is chosen.
- **Client names, testimonials, credentials** — nothing unverified is published.
- Deployment, hosting, DNS — owner approval required.

## Pending approvals

Confirm contact details (email, phones, whether the street address appears), privacy/cookie language, client references, hosting/stack, contact-form provider, and final bilingual copy. The authentic logo is in place; an original vector master remains welcome for large-format use.
