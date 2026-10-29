# TaxTech — AI-Assisted Withholding Tax Preparation

## Demo configuration and other tax years

This demo is configured for FY2024–25 (Tax Year 2025), July 2024–June 2025. Tax constants can be modified for any tax year, together with that year’s applicable rules, thresholds, salary bands and effective dates. A developer must update and validate the configuration before enabling that year; changing rates in the admin screen alone does not enable another year. This demo does not provide a tax-year switch or simultaneous multi-year schedules.

Ledger review is an input step in withholding-tax preparation. TaxTech supports income and sales-tax withholding workflows: upload, AI assistance, invoice evidence, human approval, deterministic draft batches and internal PDF summaries. SECP and reconciliation are supporting tools. AI cannot approve, file or pay.

FY2024–25 means 1 July 2024 through 30 June 2025, called Tax Year 2025 in this demo. It is not a permanent product restriction. It is the configuration currently implemented and validated. No additional tax year is activated by the wording changes in this release.

## What must change for another year

A developer can modify the constants and policy configuration for any target tax year. Review that year’s source material first; a year label or rate change by itself is insufficient. This is a software configuration task, not a user-facing year selector.

| Configuration | Current location | Required update |
| --- | --- | --- |
| Enabled period | `lib/tax-policy.ts` (`SOURCE_PERIOD`) and date checks in `lib/tax-assessment.ts` | Set the target effective dates consistently. Preserve blocked periods until validation passes. |
| Income and provincial sales-tax policy | `lib/ty2025.ts` | Update policy version, categories, rates, thresholds, eligibility, jurisdictions, recipient types and any case-specific effective dates. A new law may require additional logic. |
| Stored rule catalog | `db/seed.ts`, `db/seed-st.ts`, `scripts/migrate-ty2025.ts`, database rule records | Prepare a reviewed migration; seed insertion alone preserves existing rates. Reconcile the database with the selected policy. |
| Salary schedule | `data/salary-schedule.json`, `lib/salaryWHT.ts`, employee year validation | Update bands, base taxes, surcharges and allowed year together. Check annual boundaries and any changed calculation method. |
| User-facing year defaults and samples | `lib/validation.ts`, salary/review/monthly pages, API year defaults, judge fixture and sample CSVs | Search for `2025`, `2024-07-01`, `2025-06-30`, `TY2025` and policy-version references across source and tests. Update applicable defaults, evidence labels and samples. Keep intentional historical fixtures separate. |
| Help and documentation | `lib/product.ts`, `lib/ai/guide.ts`, tour, README, judge guide and submission copy | Explain the newly enabled configuration and the cases actually reviewed. |
| Verification | Unit tests and isolated workflow tests | Verify dates, slab edges, thresholds, authorities, invoice reconciliation, unsupported cases and historical-batch protection. |

The master-rule editor changes selected stored rates; code checks the reviewed policy and may reject inconsistent edits. It does not replace the effective-date checks or salary schema. Different years can introduce rules that need new calculations, not just new numeric constants.

## Preserve historical records

Before changing a live installation, back up its data and test the migration in isolation. Preserve approved batch snapshots. The current shared rule master is not a simultaneous, immutable multi-year schedule store. Serving multiple years at once requires versioned schedules selected by transaction date, with preserved historical approvals and regression checks. Do not overwrite the only active rule master and advertise both years as concurrently supported.

## Public wording

Use the title **TaxTech — AI-Assisted Withholding Tax Preparation**.

Suggested short explanation: “This demo is configured for FY2024–25. Tax constants can be modified for any tax year, together with that year’s applicable rules and effective dates, and validated before activation.”

Keep the demo’s case limitations, separate salary-estimate scope and human-review requirement visible. Configurability does not mean every tax year or case is already enabled or verified.
