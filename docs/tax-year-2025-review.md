# Agreed release scope: 2024–25 (Tax Year 2025)

Owner decision, 21 October 2026: the release may support only 1 July 2024 through 30 June 2025. Current-year/TY2027 support is outside this release. The existing period gate already enforces this window for calculation and approval.

## Review result: historical tax accuracy is not yet cleared

Restricting the period does not validate the supplied workbooks. The following differences were checked against the official FBR TY2025 rate card, linked from its [historical rate-card index](https://www.fbr.gov.pk/withholding-taxes-rate-card/174298/174301). The official [PDF](https://download1.fbr.gov.pk/Docs/20248211184455183WithholdingTaxRegimeRatesCard2024.pdf) was downloaded and pages 7, 8 and 10 visually inspected on 21 October 2026. The card itself states that the statute prevails over the card.

| Category | Existing seed: ATL / not ATL | Official TY2025 card | Evidence |
| --- | --- | --- | --- |
| Ordinary goods, company recipient (not toll manufacturing or the special goods categories) | 4% / 8% | 5% / 10% | PDF page 7 |
| Ordinary goods, other recipient | 4.5% / 9% | 5.5% / 11% | PDF page 8 |
| Other services, company recipient | 8% / 16% | 9% / 18% | PDF page 8; specified services have separate treatment |
| Other services, other recipient | 10% / 20% | 11% / 22% | PDF page 8; specified services have separate treatment |
| Electronic/print media advertising | 1.5% / 1.5% | 1.5% / 3% | PDF page 8 |
| Prize bonds | 15% / 25% | 15% / 30% | PDF page 10 |
| Lottery/raffle/quiz winnings | 20% / 20% | 20% / 40% | PDF page 10 |
| Section 156A petroleum-agent commission | 12% / 12% | 12% / 24% | PDF page 10 |

These comparisons concern committed seed data and its supplied-workbook snapshot. The deployed database was not queried in this scope review, so these values must not be presented as a fresh inspection of live rule rows.

Other observed release gaps:

- The rent rule `155_rent_company_payer` uses recipient type `all` and describes the payer as a company. Flat company rent treatment must distinguish a company recipient from an individual/AOP landlord. Tiered rent currently throws an explicit unsupported error.
- Salary configuration has no numeric bands. Salary withholding is explicitly unavailable; this is not complete salary support.
- Sales-tax seed rules contain blanket factors and historical rates without sufficient eligibility context. For example, SRB's official [2023–24 annual report](https://www.srb.gos.pk/srb/wp-content/uploads/2024/12/AR-2023-24-NEW_opt.pdf) records the standard-rate change to 15% in July 2024; the seed still uses 13%. Each authority needs date-specific rule and exemption verification for this historical period.
- Existing source-reference tests prove fidelity to the provided workbook rows. They do not establish agreement with legislation.

## Release acceptance

Before client tax calculations can be described as ready, reconcile each enabled rule with authoritative historical sources and applicability conditions, migrate active configuration without altering approved history, and verify the resulting amounts end to end. Boundary tests must cover the start/end of the year, recipient and ATL status, special service categories, exemptions, annual thresholds and any within-year amendments. Unsupported cases must be clearly excluded rather than assigned a generic rate.

This is an initial historical accuracy review, not an exhaustive legal certification. No calculation rules or live database values were changed by this scope clarification.
