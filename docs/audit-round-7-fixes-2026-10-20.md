# Duplicate-column repair — October 20, 2026

The duplicate-heading ambiguity from the [seventh audit](audit-round-7-2026-10-20.md) is repaired in preview and direct import. Application behavior rejects the ambiguous source instead of silently choosing a column. No schema migration, account/service setup, publication or deployment is required.

## Behavior

The shared parser validates named headings before it builds any keyed row objects. Repeated names are rejected after ignoring case, leading/trailing whitespace and repeated internal whitespace. The error gives the sheet name, conflicting label and column numbers, and asks the user to make the source headings unique and upload again. Preview and import return HTTP 400 with that same actionable explanation. Directly calling import cannot bypass the preview protection.

This deliberately requires unique names for every named column in the detected header row, including unused named columns. Blank unused headings remain allowed. Row objects use a null prototype so special labels such as `__proto__` are retained as ordinary source data. This does not add arbitrary column renaming or guess which physical column the accountant intended.

After the source labels are made unique, the existing mapping selects the intended column normally. The repaired regression renames the second heading to `Other debit`, confirms that preview preserves both **100000** and **1**, and verifies that mapping `Debit` stores **100000.00**. A successful repeated import still returns 409 rather than duplicating records.

`lib/parser.ts` supplies the shared validation; both upload routes expose only the controlled header error. Unrelated parser failures keep their generic error handling.

## Verification

Fresh checks passed: lint, TypeScript, all **27 unit tests**, production compilation without build-time secrets and whitespace checks. The complete duplicate-header integration regression passed, including rejection without side effects, correct imported **100000.00**, and safe retry behavior. Both Excel date epochs and the import-failure rollback/retry regression passed. The live workflow passed all 13 checks, including real NVIDIA/Nebius review, contextual assistance, human approval, batch arithmetic, PDF export and retained payment history. All nine boundary/permission checks also passed.

The exact-money integration also passed all nine cases, including exact large amounts through both tax lanes, approvals, summaries, a PDF response and rejection of inconsistent legacy rows. Other suites from the prior 100-check audit were not all repeated in this scoped repair, and that historical total is not presented as a fresh full run.

The new unit groups cover duplicate amount/date/description/account headings, case/whitespace variants, serialized CSV, serialized Excel, uniquely renamed columns, explicit selection of either distinct column, blank unused columns and special object-property labels. Existing exact-money and both Excel-date-epoch tests remain in the unit suite.

The former observational probe at `tests/audit-duplicate-headers.integration.ts` is now an asserting regression. It checks both preview and direct-import failures, an unchanged count of suppliers/transactions/import receipts/audits after rejection, corrected source preview/import and duplicate retry rejection. It runs only against the isolated `install_*` configuration on localhost:3002; diagnostics are private at `/tmp/taxtech-round7-fixed-headers.json`.

Final inspection found zero remaining fault triggers. The isolated test server was stopped and the main local server remains running with the repaired production bundle.

No supplied client workbook is modified. Integration records and users are synthetic and kept in separate fixture companies. Live AI checks consume provider credits. No real tax payment or filing is made.

## Release scope

This repairs the reproduced mapping defect. It does not make a universal production-readiness claim. The prior historical schedule window (July 2024–June 2025), absent numeric salary bands, final HTTPS address, legacy owner password change, developer-tool advisories and deferred hosted/operational verification remain as documented. No fresh browser interaction or PDF visual audit is claimed for this parser-only fix.
