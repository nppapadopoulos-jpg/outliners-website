# OutLiners website

Bilingual (EN/EL) static website for **OutLiners — Boutique Recruitment & Talent Advisory**, built from `docs/WEBSITE_MASTER_BRIEF.md`. It is **not deployed** to outliners.gr.

## Structure

```
index.html                                  Home
services/index.html                         Services overview
services/recruitment-executive-search/      Service detail
services/embedded-talent-partner/           Service detail
services/talent-advisory/                   Service detail
industries/index.html                       Sector focus
about/index.html                            About + candidate channel
contact/index.html                          Contact details (no form yet — see below)
privacy-policy/ , cookies/                  Legal drafts, pending legal review
404.html                                    Not-found page
assets/css/styles.css                       Design system (monochrome, tokens, responsive)
assets/js/main.js                           Language toggle, mobile nav, reveal, year
assets/fonts/InterVariable.woff2            Self-hosted Inter (OFL, license alongside)
assets/img/                                 Provisional logo mark, OG image, touch icon
sitemap.xml , robots.txt , favicon.svg
```

No build step, no dependencies, no trackers, no cookies. The language preference is kept in `localStorage` only.

## Local preview

Pages use root-relative URLs, so preview with a local server rather than `file://`:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The ΕΛ/EN button toggles languages and persists the choice.

## Brand

The owner supplied an image of the original OutLiners black-and-white business card. The nested-square mark in `assets/img/logo-mark.svg` (and inlined in headers/footers) is a **provisional approximation** — replace it with the owner's original vector asset before deployment. Do not redesign the logo.

## Deliberately not included yet (pending owner decisions)

- **Contact form** — waiting on email provider choice; spam protection and privacy disclosure come with it.
- **Public pricing** for Embedded Talent Partner — pages say "Request a tailored proposal" per the brief.
- **Final legal text** — privacy/cookies pages are clearly-marked drafts; do not invent policy text.
- **Real `/el/` routes with hreflang** — Greek is currently a client-side toggle; dedicated localized URLs need a static-site generator or hosting rewrite decision (stack is an open decision in the brief).
- **Client names, testimonials, credentials** — nothing unverified is published.
- Deployment, hosting, DNS — owner approval required.

## Pending approvals

Confirm contact details (email, phones, whether the street address appears), logo master asset and display capitalization, privacy/cookie language, client references, hosting/stack, and final bilingual copy.
