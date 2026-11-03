# Short final privacy review — prepared 4 November 2026

This is a review pack, not an assertion of legal certification. No legal page or
form change in this PR has been published. The registered identity supplied by
Owner is used verbatim: OUTLINERS Ε.Ε., Καλλιρρόης 23, 11743 Αθήνα, ΑΦΜ 802260643,
ΓΕΜΗ 173168403000; info@outliners.gr.

## Proposed purpose/basis/retention matrix (implemented in source)

| Purpose | Basis / user action | Intake retention |
| --- | --- | --- |
| Candidate-initiated specific opportunity | Art 6(1)(f), legitimate recruitment interests; role/reference required if no pool opt-in | Up to 3 calendar months, earlier when no longer needed |
| Other future opportunities | Separate unticked Art 6(1)(a) opt-in; optional for specific-role applicants | Up to 12 calendar months |
| Specific employer disclosure | Explain recipient/opportunity first and obtain specific consent/authorization; manual workflow, never automatic | Only necessary information; recipient has own notice/duties |
| Business Request Talent | Art 6(1)(f); 6(1)(b) where individual is prospective contractual party | Up to 12 calendar months in intake system |
| Optional visitor analytics | Prior Art 6(1)(a)/cookie consent, Basic Consent Mode | Local preference and GA cookies configured 180 days; GA event retention to be set to 2 months |
| Security / rights / statutory records | Proportionate legitimate interests or specific legal obligation, as applicable | Purpose-specific; no silent extension of CV retention |

`consent=yes` is the legacy field name for notice acknowledgement, not blanket
consent. New records identify its purpose/version. `talentPoolConsent` and
`processing` record separate future opt-in and specific-opportunity purpose.
The backend rejects a CV with neither a role reference nor explicit pool opt-in.
The public site must be released together with this backend schema; gates stay
closed until the approved coordinated release.

## Legitimate-interest assessment prepared for sign-off

Purpose: reply to a person who intentionally applies for a named opportunity;
provide a relevant, human-reviewed recruitment service. Necessity: use only
contact/professional data needed to assess and reply; no unrelated marketing or
automatic forwarding. Balance: expected candidate-initiated use, short maximum
retention, optional pool kept separate, no sensitive data requested, private
Owner/MFA access, objection/erasure process and no automated significant decision.
Owner/legal reviewer should approve or adjust this assessment before live intake.
Do not assume candidate recruitment is always pre-contractual Art 6(1)(b), since
OutLiners is not necessarily the prospective employer/contractual party.

## Rights and operational handling

- Contact info@outliners.gr; record request date/type, verify identity proportionately,
  respond within one month or explain a lawful extension in time.
- Owner can locate records in the private Dashboard. The prepared Owner erasure
  action requires the same strict MFA/token checks, same-origin POST and explicit
  confirmation. It atomically moves deleteAfter to now, hides the record/file
  immediately, and the existing hourly purge removes the complete prefix. Failed
  deletions keep the metadata retry marker. Seven-day soft deletion still applies.
- Access/export/correction and restriction requests require human handling. Do not
  put their contents in GitHub or Analytics. Record minimal completion evidence
  in a private business record; do not forward CVs to diagnose an issue.
- Withdraw pool consent: stop unrelated matching immediately. If no other lawful
  purpose applies, erase via the Owner action. For an ongoing named-role purpose,
  restrict to that purpose and handle the withdrawal/correction privately.
- If legally required preservation is needed, document the actual obligation,
  preserve only necessary information in a separately restricted lawful record,
  and explain any erasure exception. The intake timer itself has no legal hold.
- After an infrastructure restore, reapply deletion deadlines before reopening
  access. Soft-deleted objects are not a normal candidate archive.
- For a suspected breach, contain access, preserve minimal evidence, assess risk
  promptly, document the incident and assess statutory notification duties/timing.

## Only material legal/account items left

1. Final Owner/legal sign-off of the stated bases/balancing, sharing procedure and
   purpose-specific retention. The EL/EN public texts are ready for that short review.
2. Confirm the actual Microsoft processing terms and the role/arrangement for
   ATCOM-administered email; no migration or mailbox change is proposed. EU CV
   storage is verified but limited international provider operations are disclosed.
3. In the Owner's Google account, accept applicable Analytics processing terms,
   set two-month event retention, disable Signals/ad personalization/data sharing
   and Enhanced Measurement, then provide the real stream Measurement ID.
   No Analytics account/terms acceptance or real provider event test is claimed here.

## Primary review references checked

- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679
- Hellenic DPA cookies: https://www.dpa.gr/el/enimerwtiko/deltia/systaseis-gia-ti-symmorfosi-ypeythynon-epexergasias-dedomenon-me-tin-eidiki
- Google Basic Consent Mode: https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic
- Microsoft DPA: https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA
- Microsoft transfers: https://learn.microsoft.com/en-us/privacy/eudb/eu-data-boundary-transfers-for-all-services
- Google transfers: https://business.safety.google/adsdatatransfers/
