# Current tax reference review — 21 October 2026

**Result: the existing Finance Act 2024 rule master must not be used for current-year calculations.** The production period gate remains unchanged. No current-year tax schedule has been activated by the operations release.

The FBR [rate-card index](https://www.fbr.gov.pk/withholding-taxes-rate-card/174298/174301) now lists Tax Year 2027 and its Finance Act 2026 update. The official PDF and spreadsheet were retrieved; their URLs and SHA-256 checksums are recorded in `data/current-reference-review.json`. The actual PDF header says updated through 30 June 2026. Pages 7–8 show material changes in goods, services and contracts. Page 10 also distinguishes the rent recipient, so the old broadly named rent category cannot simply be carried forward.

Examples checked directly against the official card, for review rather than activation:

| Treatment in current official card | ATL | Non-ATL | Required context |
|---|---:|---:|---|
| Section 153 goods, company, excluding toll manufacturing | 5% | 10% | Recipient is a company; exclude toll manufacturing and separately specified goods |
| Section 153 goods, other recipient, excluding toll manufacturing | 5.5% | 11% | Recipient and supply type must be known; exclude separately specified goods |
| Section 153 independent professional services | 15% | 30% | Includes independent accountants; do not map every service to this category |
| Section 153 other services | 14% | 28% | Excludes separately specified service categories |
| Section 155 rent received by company | 15% | 30% | Classification depends on recipient; individual/AOP treatment is tiered |

These are examples of why replacing a date or reusing a generic rule key is unsafe; they are not a complete current schedule or taxpayer-specific advice. The card says the amended statute prevails over the summary.

## What an activation release needs

1. Separate immutable schedule versions for TY2025, TY2026 and TY2027, with applicability dates and source references. Preserve historical rates and approved batches; do not overwrite the one global rule master.
2. Revised rule categories and verified recipient/payment attributes where the new law differentiates them. Handle deleted categories, thresholds, late-filer distinctions and special regimes explicitly.
3. Salary slabs plus applicable surcharges and annual aggregation; rent slabs based on recipient and annual amounts. The current batch engine deliberately blocks these unsupported treatments.
4. A separate federal and each provincial sales-tax review. The FBR [Sales Tax Act index](https://fbr.gov.pk/Categ/Sales-Tax-Act-1990/301/1000) lists the Act amended through 30 June 2026. That federal source does not establish the current SRB/PRA/KPRA/BRA schedules. Current notifications and amendments must be reconciled for the jurisdictions offered to clients.
5. Review current SECP requirements against applicable company type, exemptions and amendments. Existing calendar output is based on the supplied workbook; source discovery alone does not certify every company obligation.
6. Boundary/threshold tests, annual slab/surcharge tests, old-versus-new-period tests, approval fingerprint/version checks and representative accountant-reviewed examples before deployment.

The current-year tax gate is a genuine unfinished product requirement. Backups, monitoring and hosting verification do not satisfy it. Do not market this release as supporting current-year client filing until the activation release is completed and checked.

## All five authorities: further verification

The owner confirmed that all five authorities must be included. The additional source PDFs were retrieved from the authorities' own sites and fingerprinted in the reference manifest. This is evidence of the required model changes, **not** a newly activated schedule.

| Authority | Official evidence checked | Material implementation difference |
|---|---|---|
| FBR | Sales Tax Act amended through 30 June 2026, Eleventh Schedule, printed pages 220–223 | Agent type, active-taxpayer status, distributor/wholesaler status and supply exclusions affect withholding. A private-company purchase from a non-active supplier can use a percentage of gross value rather than a fraction of invoice sales tax. The existing universal registered/unregistered factor model cannot represent every case. |
| SRB | Current consolidated Withholding Rules, PDF pages 10–14, including 2026 amendments | The ordinary invoice example uses 15% sales tax with one-fifth withheld, while specified government/public agents have four-fifths treatment and listed services can require full withholding. Invoice-tax versus tax-inclusive gross treatment also matters. The supplied flat 13%/full-withholding categories cannot be carried into the current period. |
| PRA | Official 17th edition 2026–2027 compilation, Withholding Rules 2015, PDF pages 405–408 | Rule 5A distinguishes certain telecom/banking/insurance company recipients (80% of tax) from other company recipients (20% of tax) for qualifying active service-provider companies. Other rules and exclusions still apply. The separately available 2012 rules were expressly repealed by the 2015 rules and must not be used as the current authority. |
| KPRA | Official Withholding Regulation 2024, paragraphs 4–6 | Excluded services, full-withholding cases and a 50%-of-tax residual rule differ. Public-sector receipts, reduced-rate services and unregistered/inactive suppliers require separate treatment. Treating all services as full withholding would be wrong. |
| BRA | Base Withholding Rules 2018 plus 3 February 2026 amendment; revised-rates circular applicable 1 July 2026 | The standard ordinary invoice illustration uses one-fifth of tax, while specified services and unregistered cases differ. Some cases use the tax fraction on tax-inclusive amounts. The July 2026 circular adds conditional reduced rates; the old blanket hotel/restaurant rate cannot represent them. |

The tax upgrade therefore needs verified **buyer** status as well as supplier status, service/supply classifications, invoice tax/base evidence, applicable exclusions, exemption/reduced-rate conditions and period versions. A supplier-registration checkbox and a single gross-times-rate-times-factor formula are insufficient. Current income-law verification also confirmed the changed service categories in the consolidated Ordinance (First Schedule Part III, PDF pages 562–564), consistent with the Finance Act 2026 amendments.

Scanned BRA documents were rendered and read visually; no numeric schedule was inferred from empty PDF text extraction. The official PRA compilation was used in preference to the stale standalone 2012 rules. A full latest-amendment/exemption reconciliation and applicable-taxpayer examples remain required before claiming complete current-year coverage.
