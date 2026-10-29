# Re-audit fixes — October 20, 2026

> Historical report: findings below describe the dated run and are retained as evidence. Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

**Later audit:** [the third audit](audit-round-3-2026-10-20.md) confirms these five fixes and records additional failure-path findings. This report documents the preceding implementation pass.

This handover supersedes the five open software findings in [the re-audit](re-audit-2026-10-20.md). Publishing and deployment remain deferred. The supported calculation scope is the supplied historical reference basis, not current-year filing software.

## Changes

| Re-audit finding | Implemented behavior |
| --- | --- |
| Unverified supplier type reached approval | Income calculation flags missing recipient evidence even with known filer status. Final approval independently checks live recipient type, confirmation timestamp, filer status and active rule, including legacy drafts whose stored review flag was false. Manual choices and remembered categories follow the same gates. |
| Historical rates were used for unsupported years | Both engines and both final-approval paths enforce July 2024–June 2025. Old out-of-window drafts are also blocked. Upload and review remain available for other dates, but calculations need an appropriate reviewed schedule. Monthly controls and assistance explain the restriction. |
| Partial payments were ignored | Reconciliation sums each recorded challan payment, including part-paid batches. Approved liability and draft estimates are separate. Part-paid months are labelled. The report explicitly describes its calendar-year scope and does not claim to be a filed annual statement. Exact decimal subtraction preserves one-cent differences; only zero variance is balanced. |
| Empty income recalculation retained a positive draft | Recalculation atomically removes obsolete draft links, lines and batch. It returns no batch with an explanation. Review handles this response without navigating to a missing batch. Approved periods remain locked. |
| Incomplete challans did not recover | Generation writes every missing section and its audit record atomically, leaves existing records/CPRs untouched, and is idempotent. Repair restores an appropriate unpaid batch state. Payment recording checks the complete expected section set before accepting a new payment. |

The July–June normal tax-year convention was verified against [FBR's tax-period guidance](https://www.fbr.gov.pk/income-tax/81145/81149). The supplied Finance Act 2024 / Tax Year 2025 references determine this conservative supported window. This does not establish that every supplied category or rate is legally applicable to every taxpayer, or support special tax years. No missing salary band was invented.

## Verification

- Lint, TypeScript and **16 unit tests** pass. Production compilation works without database/authentication/AI build secrets.
- Runtime dependency audit reports **zero known advisories**. The previously documented 13 development-tool advisory entries remain; they are not part of the standalone runtime.
- Core workflow and boundary suites passed with live AI review and assistance. Their synthetic transactions now use supported periods and explicitly confirmed supplier metadata. The unsupported-year rejection is covered separately rather than allowing those old fixtures through the new gate.
- The former audit probes are now assertion-based regressions: they fail the process if a safety outcome is wrong. They cover independent approval evidence checks, unsupported income and sales periods, unsupported legacy draft approval, removal of empty income drafts, partial-payment rendering, missing-section recovery, idempotent regeneration, payment-history preservation, full payment completion and one-cent variance rendering.
- Final verification completed: **13 live workflow checks, nine boundary checks, 28/28 supplied-ledger audit checks and 11 release regression checks passed**. Together with 16 unit tests, these are 77 existing selected checks. The five additional re-audit regressions and one-cent rendering case also passed, including preserving the original CPR and completing the repaired batch as paid. Counts describe exercised cases, not exhaustive coverage or legal certification.

Integration tests use synthetic companies and temporary accounts. Recorded CPRs in these fixtures are explicitly fake; no tax filing or payment was made. Live AI tests consume credits. Existing business records and the supplied workbooks were not modified. Private test outputs remain outside the repository.

The revised supplied-ledger test uses an empty supported month for its synthetic income/sales invoice. Its earlier run correctly failed when the synthetic invoice shared a month with still-pending real sample entries; no real pending entries were approved or excluded to bypass that gate.

## Remaining release limits

- Numeric salary slabs are absent from the supplied files; salary tax remains unavailable. Tiered rent and unsupported calculations remain explicit rather than guessed.
- Browser access is still disabled in Work settings. HTTP responses and end-to-end APIs were exercised, but visual interaction with the new controls remains unverified.
- Final HTTPS configuration, the owner's legacy-password change, hosted checks, backup scheduling, restricted production database identity, provider budgets and judge access belong to the deferred deployment phase. Existing password restrictions remain enforced.
- No Docker daemon, hosted CI run, external penetration test, high-load certification or expert-labelled AI accuracy benchmark is claimed. Earlier fresh-install and backup/restore verification remains recorded in the hardening report; these were not repeated for this change because no database schema changed.

## Reproduce

With the production bundle running locally against a non-production database:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run test:workflow
npx tsx tests/boundaries.integration.ts
npm run test:audit
npm run test:release
npx tsx tests/reaudit-edges.integration.ts
npx tsx tests/reaudit-payments.integration.ts
```

Run `test:release` after `test:audit`, and the payments regression after the edges regression. Do not run two copies of a suite concurrently: these pairs exchange private fixture identifiers under `/tmp/`. No new migration is required by these five fixes; the preceding additive release migration must already be installed.
