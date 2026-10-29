# Eighth audit — October 20, 2026

> Historical report: findings below describe the dated run and are retained as evidence. Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

This pass rechecks the current local application after the duplicate-column repair. It makes no application changes and does not deploy or publish anything. **Verdict: no new financial-workflow or tenant-isolation defect was confirmed in this pass. The repaired business paths passed.** One quota assertion failed in the supplied-ledger suite; its focused retry passed. The initial failure is retained below, and this is not recorded as a clean full pass.

## Scope

Fresh checks cover static validation and production compilation, live NVIDIA/Nebius review and assistance, supplied-ledger import, duplicate-header rejection and correction, exact-money handling, both Excel date epochs, human review, company isolation, approval concurrency, audit rollback, payments and reconciliation. Source review also revisited route ownership checks, session/password controls, calculation-input fingerprints and release configuration checks.

## Results

| Suite | Fresh result |
| --- | --- |
| Lint, TypeScript, production compilation without build-time secrets, whitespace | Pass |
| Unit tests | 27/27 |
| Live end-to-end workflow | 13/13 |
| Boundary / permission checks | 9/9 |
| Supplied-ledger and live AI audit | **27/28**, quota assertion failed |
| Release regressions | 11/11 |
| Income/sales approval concurrency and audit rollback | 6/6 |
| Duplicate-header rejection, no side effects and corrected source import | Pass |
| Exact-money integration | 9/9 |
| Excel date epochs and import-failure recovery | Pass |
| Additional mutation/audit failure checks | Pass |

The audit-outage regression passed: seven mutation paths rolled back, unaudited income/sales input changes were rejected, and recalculation/approval succeeded. The partial-payment, incomplete-challan recovery, retained CPR, full-payment and one-cent reconciliation regressions passed again. Recipient evidence, unsupported-period rejection and obsolete-draft cleanup also passed. The duplicate-column repair rejected both preview and direct import without writes, then imported the corrected source's intended **100000.00**.

## Quota-test failure and focused retry

The supplied-ledger suite's `AI request quota returns usable failure` assertion expected HTTP **429** and received **503**. The other 27 checks passed, including all three ledger-review AI batches, missing-evidence assistance and action/link-request resistance. The original diagnostic records the status mismatch; it does not retain the failed response body, so this audit does not claim an exact provider error message or root cause for the 503.

The test fills only the current minute's quota bucket before making its request. Database inspection found the synthetic user's **23:01 PKT (18:01 UTC)** assistant bucket at five requests and the adjacent **23:02 PKT (18:02 UTC)** bucket at one. That is consistent with the request crossing the minute boundary, when the new minute legitimately has fresh allowance. Source inspection confirms that this fixture has that timing window. This is an inference from source and bucket evidence, not a claim that the original request's exact quota-check instant was recorded.

A separate focused retry in `tests/audit-quota-retry.integration.ts` filled the current and immediately following minute buckets for the same synthetic audit user, then called the actual assistant endpoint. It returned **429** with **“Please wait a minute before requesting more AI help.”** The application limiter was not changed. The focused retry passes lint/TypeScript and its private evidence is `/tmp/taxtech-round8-quota-retry.json`.

The original failure remains in `/tmp/taxtech-audit/results.json`; it is not overwritten as a successful 28/28 run. The main audit's minute-sensitive quota fixture needs stabilization for reliable repeated audits. A successful focused retry does not guarantee provider availability or erase the observed 503. No new financial calculation or tenant-isolation defect has been confirmed in the completed checks.

## Remaining release conditions

- The local deployment gate requires a final HTTPS origin and one legacy owner's password change. No human password is changed by this audit; the password regression uses a synthetic account only.
- The supplied calculation schedules support **July 2024–June 2025**. Current-year calculation support and numeric salary bands are not supplied or invented.
- Deployment, hosted access, operational verification and publication remain deferred by the owner.
- Runtime dependencies again report **zero** known advisories. The full developer installation still reports **13** entries: nine high and four moderate. These maintenance advisories remain outstanding.
- No fresh interactive browser visual test, device matrix, PDF layout review, penetration test, model accuracy benchmark or contest eligibility/rules review is claimed. Authenticated page responses and PDF response generation are exercised by integration tests. These are narrower checks.

## Test data and cleanup

Integration tests create synthetic companies/accounts and financial fixtures. Live AI calls consume provider credits. No real tax payment, filing or supplied client-workbook modification is performed. Concurrency and fault-injection tests run on the separate `install_*` database described by the private `/tmp/taxtech-fresh-env.json`, using scoped temporary triggers and restoring rule edits. Final inspection confirmed zero remaining fault triggers and restored isolated rule rates of 4.000% income and 17.000% sales. The isolated test server was stopped; the main local application remains running. Private diagnostics and generated credentials stay outside the repository.
