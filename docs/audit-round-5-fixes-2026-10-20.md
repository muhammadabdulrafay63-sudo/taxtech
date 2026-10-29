# Fifth-audit approval fix — October 20, 2026

> Historical report: findings below describe the dated run and are retained as evidence. Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

**Later audit:** see [the sixth audit](audit-round-6-2026-10-20.md) for two newly reproduced import precision defects. This document records the preceding approval repair.

The approval/rule-edit race found in the [fifth audit](audit-round-5-2026-10-20.md) is repaired in both income-tax and sales-tax approval. No deployment or publication was performed.

## Final behavior

Final approval acquires PostgreSQL SHARE locks on both global rule tables, rechecks the exact calculation-input fingerprint, and writes the approval and its audit record within one database transaction. The tables use shared locks so different companies can approve concurrently; rule inserts, updates and deletes must wait until those approvals finish. Locks automatically release on commit, rollback or a broken connection. No schema migration or new service/account is required.

If a rule edit commits first, the approval's final check sees the changed inputs and returns HTTP 409 with a recalculation instruction. The batch stays a draft and gains no approval audit record. If approval obtains the lock first, it commits using the unchanged rate before the edit can commit. A later edit does not retroactively recalculate an already approved historical batch.

`lib/calculation-inputs.ts` now exposes a shared SQL input query so the existing application-side hash and the database's commit-time SHA-256 cover identical ledger, supplier and rule data. The commit check also retains the global rule audit freshness condition. Direct rule changes without audit events still invalidate the fingerprint. The existing company write lock continues to protect company-specific application changes, and permission, evidence and historical-period checks remain in the approval routes.

`lib/batch-approval.ts` implements the shared commit for both lanes. The guarded status update feeds its audit insert through a data-modifying CTE: a rejected update inserts no audit, and an audit-write failure rolls back the status update. Income approval records its actor and timestamp as before. Existing drafts with a valid version-one input snapshot remain usable; no destructive conversion is needed.

## Regression coverage

`tests/audit-concurrent-rules.integration.ts` is now an asserting regression rather than the previous observational probe. It requires the isolated `install_*` database and current bundle on localhost:3002. For each tax lane it exercises:

1. A paused approval followed by an actual administrator API rate edit from another company. Database lock inspection must confirm the edit waits. Approval commits at the old rate, then the edit succeeds; there is exactly one approval audit.
2. A paused direct rule update without an audit event, followed by approval. Lock inspection must confirm approval waits for the edit; the final fingerprint must reject approval with 409 and leave the draft unaudited. Recalculation must use the new rate.
3. An injected approval-audit failure. Approval must return 500 with its draft status preserved and no approval audit. Removing the fault and retrying must approve the recalculated amount with exactly one audit.

The temporary barriers only delay synthetic database updates. No tax payment, filing or supplied client-file modification is involved. Live AI integration checks consume credits. Private diagnostics and generated credentials remain outside the repository.

## Verification result

All **86 selected checks passed** against the updated code:

| Suite | Passed |
| --- | ---: |
| Unit tests | 19/19 |
| Live end-to-end workflow | 13/13 |
| Boundary/permission checks | 9/9 |
| Supplied-ledger and live AI audit | 28/28 |
| Release regressions | 11/11 |
| New concurrency/rollback cases | 6/6 |

Lint, TypeScript, production build with build-time secrets absent and whitespace checks also passed. Live AI checks exercised real ledger review and contextual assistance. No new browser/visual smoke test was required for this server-only change; the earlier screenshots remain historical evidence.

The concurrency regression reproduced correct ordering for both lanes. The income fixture recalculated from PKR 4,000 at the original rate to PKR 7,000 at the synthetic changed rate. The sales fixture recalculated from PKR 3,400 to PKR 1,400 at its synthetic changed rate. These test rates are not legal schedule recommendations. All six cases recorded `safe:true` in `/tmp/taxtech-round5-fixed-concurrency.json`.

Final cleanup inspection found zero remaining audit/import/concurrency fault triggers. The isolated rules were restored to their original 4.000% income and 17.000% sales rates, and the isolated test server was stopped. The main local server was restarted with the repaired production bundle and remains running. No real account password was changed.

The local release configuration gate was rerun and still correctly reports `readyForDeployment:false`: the final HTTPS origin and one owner's legacy password change remain outstanding. This is separate from the passing code regressions.

## Release scope

This fixes the reproduced software defect. The supplied schedule window remains July 2024–June 2025; current-year schedules and absent numeric salary bands were not invented. The owner's legacy password change and final HTTPS address remain setup conditions. Hosted verification, operational checks and publication remain deferred. These local regressions do not certify current tax law, exhaustive security or a public production deployment.
