# Selected Clients & Partnerships — logo sourcing status

Final approved list: **10 companies** (Ubentu removed by owner decision;
Skroutz excluded throughout). Status: **all 10 entries currently use the
refined typographic fallback.** No authentic logo file is committed yet, and
none has been redrawn or approximated — per the brand rule, we either use the
genuine asset or a neutral house-style wordmark.

## Why no logo files yet

The build environment runs behind a network allowlist that blocks every
company website (re-verified for all domains below, including eight8.gr), so
authentic assets cannot be downloaded or verified from official sources here.
To unblock: either allow these domains in the session's network settings, or
drop the official files into `assets/img/clients/` — activation is then a
one-line swap per entry (below).

## How to activate a real logo (no layout change needed)

1. Obtain the official asset (SVG preferred, else transparent PNG ≥ 300 px
   wide) and save it as `assets/img/clients/<slug>.svg|png`.
2. In `index.html` and `el/index.html`, replace
   `<span class="client-mark">Name</span>` with
   `<img src="/assets/img/clients/<slug>.svg" alt="Name" width="W" height="H" loading="lazy">`
   (real intrinsic dimensions to prevent layout shift).
3. The CSS already applies the monochrome white treatment
   (`filter: brightness(0) invert(1)`, 72 % rest opacity, 100 % on hover) and
   optical sizing by height — original proportions preserved, nothing
   stretched. SVG renders crisply on Retina; for PNG supply 2×.

## Per-company status (approved order)

| # | Company | Slug | Identity | Official logo source | Status |
|---|---|---|---|---|---|
| 1 | ATCOM | `atcom` | Greek digital business agency, Athens (founded 2000) | https://www.atcom.gr | identity confirmed; asset pending download |
| 2 | LetsFerry | `letsferry` | Greek online ferry-ticket platform, Piraeus | https://www.letsferry.gr | identity confirmed; asset pending download |
| 3 | LearnWorlds | `learnworlds` | Course-platform SaaS with Greek roots | https://www.learnworlds.com | identity confirmed; asset pending download |
| 4 | NOISIS | `noisis` | NOISIS Development Consultants S.A., Thessaloniki/Athens | https://www.noisis.gr | identity confirmed; asset pending download |
| 5 | Kenshō | `kensho` | **Kenshō Boutique Hotels** (Psarou & Ornos, Mykonos) — confirmed by owner | https://www.kenshomykonos.com | identity confirmed; asset pending download |
| 6 | Advengers | `advengers` | Athens data-inspired content/marketing agency | official domain still unconfirmed — owner to supply | identity partially confirmed; asset pending |
| 7 | Acromove | `acromove` | Edge data-center technology company, Athens presence | https://www.acromove.com | identity confirmed; asset pending download |
| 8 | Bill&John | `billandjohn` | Greek luxury property & hotel management company | own domain still unconfirmed (branding case study: nov.gr/en/bill-and-john/) — owner to supply | identity partially confirmed; asset pending |
| 9 | TravelStaytion | `travelstaytion` | Vacation-rental booking platform (London HQ, Greek founders) | https://www.travelstaytion.com | identity confirmed; asset pending download |
| 10 | eight8 | `eight8` | Creative web & digital marketing agency — **confirmed by owner** | https://www.eight8.gr | identity confirmed; asset pending download. Displayed wordmark "eight8" follows the domain and external directory listings; confirm official casing/lettermark from the site when accessible. Never render a fabricated "8ight" mark. |

Removed by owner decision: **Ubentu** (2026-11-01). **Skroutz** must not appear.

## Explicit guarantees in the current implementation

- Exactly the 10 approved names, approved order, both languages.
- No Skroutz, no Ubentu.
- No invented, redrawn or approximated logos — the fallback is a neutral
  single-typeface wordmark (site font), uniform, imitating no brand lettering.
- No external runtime image dependencies; nothing loads from third parties.
- Grid balance: 5/5 (desktop), 4/4/2 (tablet), 2 per row (mobile), centered.
