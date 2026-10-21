# TY2025 configuration correction

Release scope: 1 July 2024 through 30 June 2025. Reviewed 21 October 2026. This replaces the assumption that matching the supplied workbook constitutes verification of tax law.

## Source handling

The original workbooks in the parent `xyz` folder and `data/supplied-reference-data.json` remain unchanged. They were used to identify the intended categories, sample ledger structure and incorrect assumptions. `data/ty2025-source-review.json` records their hashes and the official documents used for corrections. The official historical ordinance/acts prevail over workbook examples. Later provincial compilations are used only where the historical text and dated amendment notes identify the relevant pre-July-2025 provisions.

## What changed

`lib/ty2025.ts` is the single reviewed catalog used by seeding, migration, review, AI options and engine checks. It enables 16 income cases and eight specific invoice-based sales-tax cases across FBR, SRB, PRA, KPRA and BRA. Existing database rule values must agree with it before calculation can proceed. Changes to code policy versions also invalidate old draft input snapshots.

Income corrections include ordinary goods 5%/10% for company recipients and 5.5%/11% for other recipients; other services 9%/18% and 11%/22%; specified services including transport 4%/8%; contracts 7.5%/15% and 8%/16%; electronic/print media advertising 1.5%/3%; prize bonds 15%/30%; lottery and related prizes 20%/40%; petroleum-agent commission/discount 12%/24%. Separate rice/oils and toll-manufacturing cases prevent their use of the ordinary-goods rate. Company rent is explicitly a COMPANY LANDLORD case, not a company-payer rule.

These are conditional cases. The reviewer must check the actual prescribed-payer, recipient, exemption, historical ATL and category requirements. Section 153's goods/services thresholds are annual aggregates (less than PKR 75,000 and PKR 30,000 respectively), not per-invoice exemptions. The application does not infer a complete annual payment history from a monthly import. Eligibility is an explicit reviewer confirmation supported by the review note; qualifying below-threshold treatment requires evidence, not a fabricated automatic zero.

## Invoice review and calculation

Every newly approved taxable entry records a versioned invoice assessment and explicit confirmation of eligibility. The reviewer enters the income gross payment, including sales tax for section 153. Separately, sales-tax cases require a tax-exclusive value and tax shown on the invoice; that tax must match the configured standard rate. A combined section 153/sales-tax assessment must reconcile gross to base plus sales tax. Split blended invoices or partial payments before applying these cases.

The engines calculate from those recorded bases, rather than assume a ledger expense is a full invoice. For example, PKR 100,000 taxable goods plus PKR 18,000 sales tax gives income withholding of PKR 5,900 at 5% on PKR 118,000. The supported FBR 1/5 invoice case separately withholds PKR 3,600 of the PKR 18,000 sales tax.

Sales-tax examples on a PKR 100,000 exclusive value:

| Explicit case                                                                                                | Invoiced ST |    WHT |
| ------------------------------------------------------------------------------------------------------------ | ----------: | -----: |
| FBR active supplier to an eligible company that is not ST registered; ordinary 18% goods, no exclusions      |      18,000 |  3,600 |
| FBR active supplier to registered buyer, ordinary goods covered by exclusion (viii), no overriding exception |      18,000 |      0 |
| SRB ordinary private-company-agent case, standard 15%, registered active provider                            |      15,000 |  3,000 |
| SRB ordinary public-agent case under rule 1(2)(a)/(b), rule 3(4A)                                            |      15,000 | 12,000 |
| PRA registered individual/AOP provider, ordinary 16% invoice and no rule 3 exclusion                         |      16,000 | 16,000 |
| PRA active company provider, ordinary non-advertisement service under historical rule 3 exclusion            |      16,000 |      0 |
| KPRA ordinary residual standard-rate private-agent case                                                      |      15,000 |  7,500 |
| BRA ordinary registered-filer/provider invoice case                                                          |      15,000 |  3,000 |

The invoice and reviewer evidence must establish the exact case. Vendor province does not automatically determine place of supply. Registration is not automatically active-taxpayer status; the historical active status is part of the evidence confirmation. PRA company versus individual/AOP cases additionally check verified vendor recipient type. Unregistered/unknown suppliers do not get silently changed to full withholding.

## Salary schedule

The separate salary page uses the TY2025 0%, 5%, 15%, 25%, 30% and 35% bands with their correct base taxes and a 10% tax surcharge when taxable income exceeds PKR 10 million. The schedule source is the historical ordinance, First Schedule Part I Division I(2) and section 4AB. Band/base continuity is validated.

This is a salary-only projected taxable-income estimate. Monthly estimates divide annual tax by 12. They are not actual payroll true-ups: prior deductions, remaining pay periods, credits, other income and special relief require separate assessment. Income above PKR 150 million is withheld from this estimate pending a super-tax assessment. Salary is not inserted into vendor batches.

## Deliberate limits

This is not universal TY2025 coverage or a claim of perfect/legal certification. Annual individual/AOP rent slabs, non-resident/treaty cases, imports, property transactions and other unreviewed categories are not enabled in the flat-rate catalog. Specialized/reduced-rate or tax-inclusive sales invoices, unregistered suppliers and other special sectors/recipients need separate assessment. They must remain pending; do not select Not applicable or exclude a taxable entry to bypass missing support.

KPRA's new-regulation residual case is conservatively enabled only from its gazette publication on 3 January 2025; earlier TY2025 dates remain unsupported pending review of the prior regulation and commencement. The 10 July 2025 PRA rule 5A is outside this release and is not applied retrospectively.

The app does not query historical ATL lists or submit/pay tax returns. Status and applicability evidence must be independently checked by the reviewer. User certification is not independent legal verification.

## Upgrade an existing installation

1. Back up the database and ensure no company writes are in progress.
2. Using an administrative connection, run `npm run db:ty2025-migrate`. `TAXTECH_ENV_FILE` may select a private environment file; do not expose its contents.
3. The transaction adds `gl_transactions.tax_assessment`, audits the old catalogs, upserts reviewed cases while keeping rule IDs, and deactivates unsupported legacy cases. It preserves all financial lines and approved batches. Unlocked legacy approvals without an invoice assessment are audited and reopened for review. Drafts must be reviewed/recalculated before approval.
4. Deploy the matching code. Verify the release configuration gate, then test a synthetic invoice end to end.

Fresh installations use the existing schema setup followed by the new canonical income and sales seeds. Seeding inserts missing rules; use the explicit migration to upgrade already-stored rules.

## Verification

- Unit tests cover statutory rates, recipient basis, mismatched stored configurations, invoice reconciliation, unsupported dates/status and salary boundaries/surcharge.
- The isolated database regression applies the migration twice, preserves an approved legacy 4% line unchanged, reopens an unlocked legacy decision, calculates PKR 5,900 from a PKR 118,000 gross payment, checks all eight sales cases/five authorities, and verifies that a failed recalculation preserves the prior draft.
- The full workflow regression uses real Nebius inference, human approval, deterministic calculation, approval locks, PDF generation, payment-history preservation and viewer restrictions. It also checks that missing invoice assessment is rejected and the salary page renders the expected TY2025 estimate.
- Browser visual inspection is not available while local browser access is disabled. API, rendered-page and build checks are recorded separately from a visual browser check.

## Hosted release verification - 21 October 2026

The corrected application at https://taxtech-zeta.vercel.app passed a fresh synthetic hosted regression after deployment of `99cecac`. It covered real NVIDIA/Nebius review and assistance, upload and duplicate rejection, invoice-assessment rejection when missing, human decisions, income calculation/approval, locks, internal PDF generation, payment-history retention, viewer permissions and the salary estimate page. Eight sales-tax invoice cases were each reviewed through the API; their five authority batches calculated to the expected totals and were approved successfully.

The temporary production company/accounts, ledger entries and batches were removed afterward. Production returned to one owner company, one user, zero ledger entries and zero income/sales batches. The private health check returned HTTP 200, `ready`, zero server errors and zero AI errors. Production's rule gate reported no configuration errors. A private pre-upgrade PostgreSQL backup was saved before the migration.

GitHub verification passed for main ([run 39575188172](https://github.com/muhammadabdulrafay63-sudo/taxtech/actions/runs/39575188172)) and the updated staging branch. Vercel reported the production deployment ready ([deployment](https://vercel.com/muhammadabdulrafay63-4367/taxtech/HYFqyDocShizwH7oiQNnpzqCnx6s)). The Preview database was upgraded and its branch updated; a fresh protected Preview browser session was not verified because browser access remained disabled. These are test results for the documented cases, not certification of every tax scenario.
