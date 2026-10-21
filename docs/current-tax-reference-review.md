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
