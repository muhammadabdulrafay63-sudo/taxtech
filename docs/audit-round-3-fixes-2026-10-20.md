# Third-audit fixes — October 20, 2026

> Historical report: findings below describe the dated run and are retained as evidence. Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

**Later verification:** [the fourth audit](audit-round-4-2026-10-20.md) confirms these fixes, adds browser smoke testing and records two additional import findings.

This implementation addresses both findings in [the third audit](audit-round-3-2026-10-20.md). Publishing/deployment remains deferred. No database schema migration is needed for this change.

## Fixed behavior

**Audit-write failure cannot leave a partial supplier change.** Vendor updates now execute in the same database transaction as their audit record. The same separate-write pattern was repaired for vendor creation, income and sales tag changes, and income and sales rule edits. Company updates also commit with an audit event. If the audit insert fails, the associated data changes roll back.

**Final approval does not rely solely on mutation audit history.** Before calculating, each engine captures a deterministic SHA-256 fingerprint of the month's ledger, its linked vendors and the relevant rule table, read in one database snapshot. The fingerprint is saved atomically with the new batch and its calculated lines. Both approval paths compare current inputs with that stored fingerprint, in addition to the existing review/evidence and audit checks. An unaudited filer/registration/rate change therefore forces recalculation. Missing or legacy fingerprints also force recalculation. Fingerprints contain hashes, not another copy of private financial data. The check is deliberately conservative: a change to a linked vendor's details or the rule table may require recalculation even when the resulting tax would be unchanged.

This protects the application's workflow from missing mutation events; it does not make a privileged database administrator unable to alter both records and their audit history, and it is not a claim of exhaustive concurrent-write or external security testing.

**Clearing optional capital now saves SQL NULL.** Explicit null clears the value. An omitted property leaves it unchanged. Both the minimal API request and the complete settings-form request are covered; neither can silently retain the old amount after a successful clear response.

## Verification

- Lint, TypeScript, 16 unit tests and production compilation with build-time secrets absent passed.
- Runtime dependency audit: zero known advisories. The previously documented development-tool advisories remain outside the standalone runtime.
- The isolated failure regression now asserts expected results rather than merely recording unsafe behavior. It verifies company-capital clear/omit/full-form behavior and rollback of vendor update, vendor creation, company update, income tag, sales tag, income rate and sales rate writes when their audit insert is deliberately rejected.
- It also directly simulates historical unaudited input changes in the isolated database: income and sales approval must reject those drafts, then successful recalculation must produce the updated tax and permit approval.
- Final verification passed: **77 existing selected checks** (16 unit, 13 live workflow, nine boundary, 28 supplied-ledger audit and 11 release regression). The five previous edge regressions and one-cent rendering also passed. Both AI review and contextual assistance made successful live NVIDIA/Nebius calls. The new failure regression passed with actual attempted rate changes: all seven audited mutation paths rolled back, unaudited income/sales changes were rejected, and both recalculated batches approved successfully.

Failure injection is restricted to the retained synthetic `install_*` database and a single generated test user's audit events. Temporary triggers/functions are removed in `finally`; a final database query confirmed zero remaining fault triggers, and the isolated test server was stopped. No fault was injected into the user's main database; no real payment or filing was made. Integration tests make metered live AI calls and create synthetic financial records. Private outputs remain under `/tmp/` and must not be published.

## Run the new regression

Start the current bundle on localhost:3002 against the isolated database described by `/tmp/taxtech-fresh-env.json`, then run:

```text
npx tsx tests/audit-failure-recovery.integration.ts
```

The test refuses database names outside `install_[a-f0-9]+`. Existing local verification commands remain in the preceding handover. Run `test:release` after `test:audit`, boundaries after workflow, and payment regressions after the edges regression, because those pairs exchange private fixture IDs.

## Release scope

These code fixes do not add missing salary bands, expand the supplied July 2024–June 2025 schedules, deploy the app, change the owner's password, publish contest materials or complete hosted/browser QA. Existing approved history is preserved; old draft batches must be recalculated to obtain an input fingerprint. The previously documented browser, development-tool and deployment limits remain explicit.
