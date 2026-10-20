# Exact-money repair and verification — October 20, 2026

**Later audit:** see [the seventh audit](audit-round-7-2026-10-20.md) for one newly reproduced duplicate-column ambiguity. This report records the preceding precision repair.

Both precision defects from the [sixth audit](audit-round-6-2026-10-20.md) are repaired. The repair also covers related calculation, display and export paths rather than only the original examples. No publication or deployment was performed.

## What changed

- Parsed debit, credit and net amounts are canonical decimal strings. Subtraction uses integer cents. They remain decimal strings through database writes, both tax calculations, API totals, summaries and payment exports.
- All amount cell types use one validation policy. Fractional cents, malformed amounts and unsupported ranges reject the entire import before any supplier, transaction, receipt or audit is created. The error identifies the data-row number. A mixed good/bad file cannot partially import.
- Text amounts support the database's numeric(18,2) range, up to 9,999,999,999,999,999.99 in magnitude. Numeric Excel cells have a conservative limit of 999,999,999,999.99; larger values must be supplied as text. This cannot recover precision already lost inside an original Excel numeric cell.
- CSV reading preserves raw text, so decimal cents and leading-zero account identifiers do not disappear before validation. Both workbook date systems remain supported.
- Preview, ledger review, transactions, batch totals, challans, dashboard totals and reconciliation use exact two-decimal formatting. Income section totals, sales authority totals and per-vendor aggregates use integer-cent sums. Large sales-tax gross amounts no longer pass through binary floating-point formatting.
- Income and sales API monetary totals are now decimal strings. The bundled clients were updated accordingly. Any independently maintained API client must treat monetary totals as strings.
- Aggregate overflow is explicitly refused before writing a replacement draft. Tax-rule edits reject unsupported rate/factor precision and fractional-cent thresholds rather than silently rounding.
- Before calculation and approval, a stored non-excluded ledger row must satisfy debit minus credit equals amount. Inconsistent legacy rows require source reconciliation; they are not silently rewritten. A read-only scan found zero inconsistent imported rows in the main database.
- PDF amount columns were widened and numeric typography adjusted after rendering exposed overlap for extreme values. PDF extraction confirms the exact large line amount and aggregate; the final rendered layout was inspected.

`lib/money.ts` contains the shared parsing, integer arithmetic, comparison and currency formatting. `lib/parser.ts` and the import route no longer convert ledger amounts to Number or independently round three related values. The existing company isolation, human review, rule-edit/approval database locks and audit rollback remain in place. No schema migration or additional account/service is required.

## Why earlier audits kept finding bugs

The earlier suites covered the principal workflow and known regressions. Each later audit added adversarial cases such as alternate Excel dates, interrupted writes, concurrent rule edits and unusual numeric inputs. A green result established only those exercised cases, not universal readiness. The monetary design also mixed exact database decimals with Number-based parsing and presentation; fixing only one conversion would leave related paths vulnerable.

This pass therefore tests shared invariants: every accepted row preserves the source cents; saved debit minus credit equals saved net; a rejected file has no side effects; calculations and summaries retain those cents; and approval/audit writes remain atomic. These checks provide broader coverage, but do not prove that no undiscovered defect exists.

## Completed verification

| Selected suite | Result |
| --- | ---: |
| Unit tests, including five new precision groups | 24/24 |
| Live end-to-end workflow | 13/13 |
| Boundary and permission checks | 9/9 |
| Supplied-ledger and live AI audit | 28/28 |
| Release regressions | 11/11 |
| Income/sales approval concurrency and audit rollback | 6/6 |
| Expanded exact-money integration cases | 9/9 |
| Total selected checks | **100/100** |

The unit arithmetic group exercises 2,000 deterministic debit/credit pairs independently of those suite counts. Serialized Excel/CSV tests include large text decimals, negative adjustments, invalid syntax, fractional cents, overflow and leading-zero identifiers. The expanded integration suite verifies database values, both tax lanes, approvals, challan totals, rendered page text, PDF response and rejection of inconsistent legacy rows. The extreme fixture preserves gross **200,000,000,000,100.02** end to end.

The previous payment/reconciliation edge regressions also passed, including partial payments, incomplete challan recovery, preserved CPR history and one-cent variance. The date-epoch/import-recovery regression and audit-outage regression also passed, including seven atomic mutation paths, stale input rejection and recalculation approval. Live NVIDIA/Nebius requests exercised ledger review and contextual assistance; these observed passes are not an AI accuracy benchmark or provider availability guarantee. Lint, TypeScript, production compilation without build-time secrets, and whitespace checks passed.

Private evidence includes `/tmp/taxtech-round6-fixed-precision.json`, `/tmp/taxtech-round5-fixed-concurrency.json` and `/tmp/taxtech-precision-fixed.pdf`. These contain synthetic fixtures. No real tax payment or filing was made, no supplied client workbook was changed, and live AI tests consumed provider credits.

Final cleanup confirmed no remaining injected fault triggers and original isolated rates of 4.000% income and 17.000% sales. The isolated server was stopped after verification; the main local server was restarted with the repaired bundle. Synthetic records remain confined to separate fixture companies.

Browser control was disabled in Work settings during final verification. Page responses were tested through authenticated HTTP and the PDF was rendered independently; a fresh interactive browser visual check remains unverified. This limitation is not recorded as a passing browser test.

## Reproduce

Run unit/static checks with `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`. The opt-in integration commands require running local app instances and non-production data; they create synthetic accounts and records. `npm run test:precision` requires the isolated installation in `/tmp/taxtech-fresh-env.json` on localhost:3002 and refuses names outside `install_[a-f0-9]+`. Other live workflow tests use the configured local database. Review each test's fixture scope before running it.

## Remaining conditions

The final HTTPS address and one owner's legacy password change still fail the deployment configuration gate. The supplied schedules remain restricted to July 2024–June 2025, with no numeric salary bands supplied. These are not filled with invented tax data. Hosting and operational verification remain deferred by the owner.

The dependency audit still reports zero runtime advisories and 13 development-tool entries (nine high, four moderate). Registry inspection found no patched braces release beyond 3.0.3; the esbuild path also arrives through a legacy loader dependency. No forced major downgrade or unverified dependency override was applied. These development advisories remain a maintenance limitation, not a claim of a fully clean installation.
