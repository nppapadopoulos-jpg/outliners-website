# Selected Clients & Partnerships — logo sourcing status

Status: **all 11 entries currently use the refined typographic fallback.**
No authentic logo file is committed yet, and none has been redrawn or
approximated — per the brand rule, we either use the genuine asset or a
neutral house-style wordmark.

## Why no logo files yet

The build environment for this change runs behind a network allowlist that
blocks every company website (and Wikimedia/CDN mirrors), so authentic assets
could not be downloaded or verified pixel-by-pixel from official sources.
Identity research was performed via web search; findings and official domains
are recorded below.

## How to activate a real logo (no layout change needed)

1. Obtain the official asset (SVG preferred, else transparent PNG ≥ 300 px
   wide) from the sources below and save it as
   `assets/img/clients/<slug>.svg|png` (slugs listed per company).
2. In `index.html` and `el/index.html`, replace
   `<span class="client-mark">Name</span>` with
   `<img src="/assets/img/clients/<slug>.svg" alt="Name" width="W" height="H" loading="lazy">`
   (real intrinsic dimensions to prevent layout shift).
3. The CSS already applies the monochrome white treatment
   (`filter: brightness(0) invert(1)`, 72 % rest opacity, 100 % on hover) and
   optical sizing by height — original proportions are preserved, nothing is
   stretched. Retina rendering is automatic for SVG; for PNG supply 2×.

## Per-company status

| # | Company | Slug | Identity (research) | Official source for the logo | Status |
|---|---|---|---|---|---|
| 1 | ATCOM | `atcom` | Greek digital business agency, Athens (founded 2000) | https://www.atcom.gr | identity confirmed; asset pending download |
| 2 | LetsFerry | `letsferry` | Greek online ferry-ticket platform, Piraeus | https://www.letsferry.gr (also letsferry.com) | identity confirmed; asset pending download |
| 3 | LearnWorlds | `learnworlds` | Course-platform SaaS with Greek roots | https://www.learnworlds.com (press/brand page if available) | identity confirmed; asset pending download |
| 4 | NOISIS | `noisis` | NOISIS Development Consultants S.A., Thessaloniki/Athens (founded 1998) | https://www.noisis.gr | identity confirmed (domain inferred from corporate email); asset pending download |
| 5 | Kenshō | `kensho` | Kenshō Boutique Hotels (Psarou & Ornos, Mykonos) — fits the Hospitality & Premium Services sector | https://www.kenshomykonos.com | identity probable — **owner to confirm** this is the intended “Kenshō” (a US fintech of the same name exists); asset pending |
| 6 | Advengers | `advengers` | Athens data-inspired content/marketing agency (~40 staff, Nea Ionia / Nea Smyrni) | official domain not yet identified — **owner to supply** | identity partially confirmed; asset pending |
| 7 | Acromove | `acromove` | Edge data-center / portable infrastructure tech company with Athens presence | https://www.acromove.com | identity confirmed; asset pending download |
| 8 | Ubentu | `ubentu` | **not verifiable by search** (no indexed company found under this name) | — **owner to supply** correct name/domain/asset | unverified — typographic fallback |
| 9 | Bill&John | `billandjohn` | Greek luxury property & hotel management company (branding case study at nov.gr/en/bill-and-john/) | own domain not yet identified — **owner to supply** | identity partially confirmed; asset pending |
| 10 | TravelStaytion | `travelstaytion` | Vacation-rental booking platform (London HQ, Greek founders, est. 2012/13) | https://www.travelstaytion.com | identity confirmed; asset pending download |
| 11 | 8ight | `8ight` | **not verifiable by search** (no Greek company indexed under this name) | — **owner to supply** correct name/domain/asset | unverified — typographic fallback |

Research references: company websites above; plus naftemporiki.gr, amcham.gr,
builtin.com, dealroom.co, gust.com, hostaway.com, greekcitytimes.com,
nov.gr (Bill and John case study) — used for identification only, not as logo
sources.

## Explicit guarantees in the current implementation

- Exactly the 11 approved names, in the approved order, in both languages.
- **Skroutz does not appear.**
- No invented, redrawn or approximated logos — the fallback is a neutral
  single-typeface wordmark (site font), visually uniform, clearly not an
  imitation of any brand's lettering.
- No external runtime image dependencies; nothing loads from third parties.
