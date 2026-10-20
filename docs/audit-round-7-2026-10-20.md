# Seventh audit — October 20, 2026

**Subsequent repair:** see [the duplicate-column repair and verification](audit-round-7-fixes-2026-10-20.md). This document records the pre-fix audit.

**Verdict: one newly reproduced ambiguous-column import gap remains.** The exact-money and approval-concurrency repairs continue to pass. This audit adds an observational probe and documentation; it does not change application behavior or publish/deploy anything.

## New finding

| Priority | Finding | Observed result | Required correction |
| --- | --- | --- | --- |
| Medium | Duplicate mapped column names silently overwrite source values | A serialized Excel sheet has two `Debit` columns, containing **100000** and **1**. Preview exposes only **1**, import returns HTTP 200 with no errors, and the database stores debit/net **1.00**. | Reject duplicate mapped headers with a clear error before import, or use distinct column identifiers and let the user explicitly choose. Preview and server import must enforce the same policy. |

`lib/parser.ts` builds row objects using `obj[header] = cell` in both preview and import. The later identically named header overwrites the earlier one. The mapping identifies columns by header text, so it cannot distinguish the two physical columns. The test reopens the serialized workbook and asserts both original cells before exercising the parser and actual import API. This confirms a source-selection ambiguity rather than a decimal-rounding failure.

This audit does not assert which column is legally or commercially correct: it establishes that the application silently selects one when the current mapping cannot express the choice. The same mapping structure can affect other duplicated mapped fields. The controlled reproduction exercised `Debit` only. No incorrect batch was approved or paid by this probe, and there is no claim that supplied client files contain duplicate headers.

## Verification

All **100 selected existing checks passed** on this rerun:

| Suite | Passed |
| --- | ---: |
| Unit tests | 24/24 |
| Live end-to-end workflow | 13/13 |
| Boundary and permission checks | 9/9 |
| Supplied-ledger / live AI audit | 28/28 |
| Release regressions | 11/11 |
| Income/sales approval concurrency and audit rollback | 6/6 |
| Exact-money integration | 9/9 |

The new duplicate-header observation records **`safe:false`** and is separate from those passes. The exact-money integration again preserved large decimal amounts through both tax lanes, approval, authenticated page responses and a PDF response; inconsistent legacy money rows were rejected. Fresh PDF visual inspection was not repeated.

The additional recipient-evidence, unsupported-period, obsolete-draft, partial-payment, incomplete-challan recovery, retained CPR, full-payment and one-cent reconciliation regressions passed. Both Excel date epochs, failed-import rollback and safe retry also passed. The mutation/audit failure suite also passed: optional-capital clearing, seven atomic mutation paths during audit failure, rejection of unaudited income/sales input changes, and successful recalculation/approval.

Lint, TypeScript, 24 unit tests, production compilation without build-time secrets and whitespace checks passed. The new observational probe also passes lint and TypeScript. Live Nebius/NVIDIA requests covered three supplied-ledger batches, contextual assistance, missing-evidence handling, action/link-request resistance and usable quota failures. These observed passes are not an AI accuracy or availability guarantee.

Runtime advisories remain zero; the 13 development-tool entries are unchanged. The release gate correctly fails for the final HTTPS origin and legacy password condition. Existing test counts do not certify universal correctness or cancel the new finding.

## Reproduce

```text
npx tsx tests/audit-duplicate-headers.integration.ts
```

The probe requires the current bundle on localhost:3002 and the isolated installation described by `/tmp/taxtech-fresh-env.json`; it refuses database names outside `install_[a-f0-9]+`. It creates a synthetic company/account and in-memory workbook, confirms the source cells, inspects preview/parser values, imports through the actual API and checks saved values. Private output is `/tmp/taxtech-audit-round7-headers.json`. The diagnostic completes with `safe:false`; process completion is not a product safety pass.

The normal verification suites create separate synthetic companies/accounts. Isolated concurrency/failure tests use temporary scoped triggers and restore their rule edits. Final cleanup inspection found no remaining fault triggers and restored isolated rates of 4.000% income and 17.000% sales. The isolated server was stopped; the main local app remains running. Synthetic fixtures remain in their separate companies. Live AI checks consume provider credits. No real tax filing/payment or supplied client-workbook modification is performed.

## Remaining release scope

The configuration gate still reports a final HTTPS origin and one legacy owner's password change as outstanding. No human password was changed. Supplied schedules remain limited to July 2024–June 2025, without numeric salary bands. Hosting, operational validation and publishing remain deferred. Runtime dependencies have zero reported advisories; the full developer installation has 13 entries (nine high, four moderate).

No fresh browser visual test or fresh contest eligibility/rules review was performed. This pass audits local software behavior; it does not certify current tax law, live hosting, exhaustive security or final contest submission readiness.
