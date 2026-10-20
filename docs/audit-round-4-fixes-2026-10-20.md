# Fourth-audit fixes — October 20, 2026

This change repairs both import findings in [the fourth audit](audit-round-4-2026-10-20.md). Publishing and deployment remain deferred. No database schema migration is required.

## Changes

**Excel dates:** numeric date conversion now uses the workbook's 1900/1904 epoch. That metadata travels with the sheet preview and is used by both the browser preview and server import. Text dates retain their explicit calendar values. Fractional serial dates keep their correct day; invalid serial dates, including Excel's fictitious February 29, 1900, are rejected rather than normalized to another day.

**Import rollback:** supplier IDs are assigned in memory, then new suppliers are inserted in the same database transaction as the import receipt, ledger rows and audit record. If any part fails, all those changes roll back. Repeated names within a file reuse one supplier ID; existing suppliers remain unchanged. A failed import can be retried, while a repeated successful import is still rejected as a duplicate.

This fixes future imports. It does not silently rewrite dates or remove suppliers from earlier successful imports or from the retained synthetic audit fixtures. Any business records previously imported from a 1904-epoch workbook require source reconciliation; this pass did not identify or modify such real company data.

## Verification

- Lint, TypeScript, **19 unit tests** and production compilation with build-time secrets absent pass.
- Serialized-workbook unit tests verify both epochs, text dates and fractional dates. Preview and import return the same expected date.
- The isolated integration regression verifies both workbook date systems through preview API, parser and persisted database dates: **March 15, 2025 remains March 15, 2025**.
- An injected import-audit failure left supplier, transaction, receipt and audit counts unchanged. After removing the injected failure, retry imported two entries linked to one new supplier. A subsequent duplicate request returned 409.
- Browser verification used a temporary synthetic account and workbook. The actual upload/mapping/preview screen displayed **2025-03-15** for the 1904-epoch file. Screenshot: `/tmp/taxtech-round4-fixed-preview.jpg`. The browser was left at preview; the integration test separately verified committed dates.
- Runtime dependency audit: zero known advisories. Previously documented development-tool advisories remain outside the standalone runtime.
- Core live workflow (13 checks), boundary tests (nine checks), all 11 release regressions, the five earlier edge regressions and one-cent rendering passed. The supplied-ledger audit passed 27/28 checks on its first run: the missing-evidence assistant request received a provider-incomplete HTTP 503, with an explicit retry response. All three bulk AI ledger batches passed. A focused retry of the same failed assistant question returned HTTP 200, kept missing-evidence entries pending and produced company-scoped links. Its private evidence is `/tmp/taxtech-round4-fixes-assistant-retry.json`. The first audit run is retained as a failure, not rewritten as a clean pass.

The failure test only runs against the isolated `install_*` database described in `/tmp/taxtech-fresh-env.json`, using a company-specific temporary trigger removed in `finally`. A final database check confirmed zero remaining import-fault triggers, and the isolated test server was stopped. Test records and workbooks are synthetic; no real payment or filing was made, and supplied client workbooks were not changed. Live AI integration checks consume credits. Private diagnostic output remains outside the repository.

## Reproduce

Run the existing verification suites against a running local production bundle and a non-production database. Start an isolated instance on localhost:3002 using `/tmp/taxtech-fresh-env.json` for the fault regression, then run:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npx tsx tests/audit-import-recovery.integration.ts
```

The import regression now asserts the repaired outcomes and exits unsuccessfully if they regress. Private results remain at `/tmp/taxtech-audit-round4-imports.json`; all cases must have `safe:true`.

The existing historical schedule scope, absent salary bands and deferred hosted/operational checks remain unchanged. Passing these tests does not certify current-year tax law, exhaustive security or every browser flow.
