# OutLiners website

Bilingual (EN/EL) static website for **OutLiners — Boutique Recruitment & Talent Advisory**, built from `docs/WEBSITE_MASTER_BRIEF.md`. It is **not deployed** to outliners.gr.

## Structure

```
index.html                                  Home (English)
services/ , industries/ , about/ ,
contact/ , privacy-policy/ , cookies/       English pages
el/…                                        Greek mirror of every page (crawlable
                                            /el/ URLs, hreflang-linked both ways)
404.html                                    Not-found page (bilingual, noindex)
assets/css/styles.css                       Design system (monochrome, tokens, responsive)
assets/js/main.js                           Mobile nav, reveal animation, year
assets/fonts/InterVariable.woff2            Self-hosted Inter (OFL, license alongside)
assets/img/                                 Provisional logo mark, OG image, touch icon
sitemap.xml                                 Both languages with xhtml hreflang alternates
robots.txt , favicon.svg
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

Checks every page for broken internal links, missing titles/descriptions, heading structure, `lang`/hreflang correctness and image alt text. GitHub Actions runs the same script on every push and pull request.

## Brand

The owner supplied an image of the original OutLiners black-and-white business card. The nested-square mark in `assets/img/logo-mark.svg` (and inlined in headers/footers) is a **provisional approximation** — replace it with the owner's original vector asset before deployment. Do not redesign the logo.

## Deliberately not included yet (pending owner decisions)

- **Contact form** — waiting on email provider choice; spam protection and privacy disclosure come with it.
- **Public pricing** for Embedded Talent Partner — pages say "Request a tailored proposal" per the brief.
- **Final legal text** — privacy/cookies pages are clearly-marked drafts; do not invent policy text. Hosting server logs/cookies must be documented once the provider is chosen.
- **Client names, testimonials, credentials** — nothing unverified is published.
- Deployment, hosting, DNS — owner approval required.

## Pending approvals

Confirm contact details (email, phones, whether the street address appears), logo master asset and display capitalization, privacy/cookie language, client references, hosting/stack, and final bilingual copy.
