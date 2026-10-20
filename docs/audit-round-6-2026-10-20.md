# Sixth audit — October 20, 2026

**Subsequent repair:** see [the exact-money fixes and verification](audit-round-6-fixes-2026-10-20.md). This document records the pre-fix audit.

**Verdict: two new import precision defects were reproduced.** The previous approval-race repair continues to pass. This pass adds an observational regression probe and documentation; application behavior was not changed and nothing was published or deployed.

## New findings

| Priority | Gap | Reproduced result | Required correction |
| --- | --- | --- | --- |
| Medium | Numeric workbook cells bypass the parser's decimal-precision validation | A serialized Excel row contains debit **1.015**, credit **0.005**. Import returns 200 with no errors, saving debit **1.01**, credit **0.01**, net amount **1.01**. Saved debit minus saved credit is **1.00**, so the stored row disagrees with itself by one cent. | Establish a supported precision policy for every cell type. Reject unsupported fractional cents, or normalize components under an explicit rounding policy before deriving the net amount. Never save a row whose components disagree. |
| Medium | Large valid decimal text amounts silently change | An Excel text cell preserves **100000000000000.01** after serialization/reopening. Import returns 200 and saves **100000000000000.02**. | Preserve decimal strings or integer cents through parsing, subtraction and persistence. Reject unsupported magnitudes explicitly instead of silently changing them. |

`lib/parser.ts:112` returns numeric cells immediately, before the two-decimal regular expression used for strings. It then converts accepted decimal text with `Number()`. `mapRows` subtracts the resulting binary floating-point values. `app/api/upload-gl/import/route.ts:152` independently applies `toFixed(2)` to debit, credit and net. Exact arithmetic in the downstream tax helper cannot recover cents already changed at import.

The fractional-cent example uses ordinary small values; it does not depend on a huge ledger. The second example is an unusually large amount, but the import currently accepts it without a range error and it fits the database's numeric column. It should be preserved or explicitly rejected. Neither observation proves that the supplied client ledger contains such values. The probe did not approve or pay either entry; no downstream tax discrepancy was asserted.

A normal two-decimal control, debit **100.01**, credit **0.01**, imported and persisted net **100.00** correctly. The new probe therefore records one safe control and two unsafe observations. A diagnostic script completing successfully is not a passing product safety test.

## Fresh verification

All **86 selected existing checks passed** again:

| Suite | Passed |
| --- | ---: |
| Unit tests | 19/19 |
| Live end-to-end workflow | 13/13 |
| Boundary/permission checks | 9/9 |
| Supplied-ledger / live AI audit | 28/28 |
| Release regressions | 11/11 |
| Approval/rule concurrency and audit rollback | 6/6 |

The new import-precision probe adds **one passing control and two failing observations**. Existing passes do not cancel out those failures.

Additional repair regressions passed: both Excel date epochs through persisted import, complete failed-import rollback, safe retry and duplicate rejection, optional capital clear/omit behavior, seven atomic mutation paths during audit failure, rejection of unaudited stale income/sales drafts, and successful recalculation/approval.

Lint, TypeScript, production compilation without build-time secrets and whitespace checks passed, including lint/TypeScript for the new probe. Real Nebius/NVIDIA checks covered three supplied-ledger review batches, contextual assistance, missing-evidence handling, action/link-request resistance and usable quota failures. These observed responses do not establish model accuracy or continuous provider availability.

The release configuration gate still reports `readyForDeployment:false` for the final HTTPS origin and one legacy owner's password change. No human password was changed.

## Reproduce

```text
npx tsx tests/audit-import-precision.integration.ts
```

The probe requires the current local bundle on port 3002 and the isolated installation described by `/tmp/taxtech-fresh-env.json`. It refuses database names outside `install_[a-f0-9]+`. It creates a synthetic company/account and three in-memory workbooks, confirms serialized source values, calls the real import API, then queries persisted amounts and checks the cent arithmetic. No faults or global-rule edits are introduced by this precision probe. Private observations are stored at `/tmp/taxtech-audit-round6-precision.json`; both failing cases have `safe:false`.

The separately rerun concurrency and rollback regressions use scoped temporary triggers and restore their isolated rule edits. Final database inspection confirmed zero remaining fault triggers and restored isolated rates of 4.000% income and 17.000% sales. The isolated server was stopped; the main local app remains running. Synthetic audit records remain in their separate fixture companies. No real payment, filing or supplied client-file modification is involved. Live AI checks consume provider credits.

## Unchanged release scope

The supplied schedules still support July 2024–June 2025 only; numeric salary bands remain absent. The final HTTPS address, one legacy owner's password change, hosting/operational verification and publication remain separate release conditions. Runtime dependencies have zero reported advisories; the full developer installation still has 13 entries (nine high, four moderate). No new browser/visual smoke test was performed in this pass. Local regression passes do not certify current tax law, exhaustive security or production deployment.
