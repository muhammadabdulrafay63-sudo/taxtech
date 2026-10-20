# Fifth audit — October 20, 2026

**Subsequent repair:** see [the fifth-audit approval fix and verification](audit-round-5-fixes-2026-10-20.md). This report records the pre-fix audit.

**Verdict: one new high-priority approval concurrency defect remains.** All 80 selected existing checks passed again, including live AI and the supplied-ledger audit. Those passes do not cover the newly reproduced failure. Application behavior was not changed in this pass; the changes are an observational test and this report. Nothing was deployed or published.

## New finding

| Priority | Gap | Observed result | Required correction |
| --- | --- | --- | --- |
| High | A global tax-rule change can commit between a batch's freshness check and final approval | A different company's superadmin changed the filer rate from **4% to 7%** while a **PKR 100,000** synthetic batch was being approved. Both API requests returned 200. The batch finished approved with **PKR 4,000**, although the changed rule would calculate **PKR 7,000**. | Coordinate global rule edits and final approval across companies, and validate the applicable rule version inside that protected operation. A rejected stale approval must require recalculation. |

The workflow lock in `lib/workflow.ts` is keyed by company. Global rule editing in `app/api/admin/rules/[id]/route.ts` locks the administrator's company; income approval in `app/api/wht/batch/[batchId]/approve/route.ts` locks the batch owner's company. Those locks do not exclude each other. `assertBatchFresh` checks the audit trail and input fingerprint before the separate final approval database batch. A subsequent global edit therefore escapes those checks.

The deterministic probe paused the final approval update with a batch-specific database trigger, after the application's checks had completed. It then changed the rate through the actual admin API, using a separately signed-in synthetic account in a different company. After the rate-edit response, an independent database read still saw the batch as **draft**, and the approval barrier remained held. Only then did approval finish at the old amount. This confirms the rule committed before approval committed, rather than relying on response timing alone. The delay widens an existing window; the trigger does not alter rates, totals or approval decisions.

The sales-tax approval route uses the same check-before-write structure. That is a related code-review concern; the controlled concurrency reproduction in this pass exercised income tax only. No claim is made that an already approved historical batch should automatically change when rates are edited later.

Adding another freshness query alone would leave another race window. The correction should establish consistent ordering/version protection for global edits and approvals, with regression tests for both tax lanes. Any snapshot-based alternative must explicitly preserve and enforce the applicable immutable rule version.

## Fresh verification

| Existing suite | Passed |
| --- | ---: |
| Unit tests | 19/19 |
| Live end-to-end workflow | 13/13 |
| Boundary and permission checks | 9/9 |
| Supplied-ledger / live AI audit | 28/28 |
| Release regressions | 11/11 |
| Total selected existing checks | **80/80** |

Additional regressions also passed: correct 1900/1904 Excel dates through preview and stored import; complete failed-import rollback and safe retry; optional capital clearing; seven atomic mutation/audit paths; rejection of unaudited stale income and sales drafts; recalculation approval; recipient evidence; unsupported-period rejection; obsolete-draft removal; partial payments; incomplete challan recovery; retained payment history; idempotence; and one-cent reconciliation.

The real Nebius/NVIDIA checks included three supplied-ledger review batches, contextual assistance, missing-evidence handling and resistance to action/external-link requests. All passed this run. This is observed provider behavior for these requests, not an accuracy benchmark or availability guarantee. The previous fourth-fix audit's transient 503 remains recorded in its report.

Lint, TypeScript, production compilation without build-time secrets and whitespace checks passed. The added observational probe also passes lint and TypeScript. No fresh browser interaction/visual audit was performed this time; the preceding pass's screenshots remain historical evidence.

Runtime dependency audit: **zero known advisories**. The full developer installation reports **13** entries: nine high and four moderate, as previously documented. This is still a development-tool maintenance concern even though the standalone runtime excludes those packages.

## Remaining release conditions

- The local release gate still fails for a final HTTPS `AUTH_URL` and one legacy account's password change. These are outstanding setup/account actions; no human password was changed.
- Supplied schedules support **July 2024–June 2025** only. Current-year calculations remain blocked, numeric salary bands are absent, and unsupported tiered calculations remain unavailable.
- Hosting, public access, operational verification and submission/publication remain deferred by the owner. These local tests do not certify deployment, current tax law or exhaustive security.

## Reproduce and cleanup

```text
npx tsx tests/audit-concurrent-rules.integration.ts
```

This requires the current local bundle on port 3002 and the private isolated installation configuration at `/tmp/taxtech-fresh-env.json`. The probe refuses database names outside `install_[a-f0-9]+`. It creates separate synthetic companies/accounts and financial fixtures. It temporarily delays one fixture batch's approval, changes the isolated global rule through the admin API, then removes its trigger/function and restores the original rate and update timestamp in `finally`.

A final database check confirmed zero remaining audit/import/concurrency fault triggers and the restored isolated rate of 4.000%. The isolated test server was stopped; the main local application remains running.

Private output: `/tmp/taxtech-audit-round5-concurrency.json`. The diagnostic exits successfully when its observation completes; **`safe:false` is a product failure**, not a passing safety assertion. The older successful suites do not cancel it out. No real payment or filing was made and no supplied client workbook was changed. Live AI tests consumed provider credits.
