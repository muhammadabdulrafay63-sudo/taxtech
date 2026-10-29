# Final local readiness audit — October 20, 2026

> Historical report: findings below describe the dated run and are retained as evidence. Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

**Public production release: not ready for sign-off.** Passing local code checks does not complete the remaining deployment, account and tax-data conditions. No publication, deployment or account password change was performed in this audit.

## Release decision

| Area | Evidence / decision |
| --- | --- |
| Code compilation and unit checks | Lint, TypeScript, 27 unit tests, production compilation without build-time secrets and whitespace passed |
| Historical, human-reviewed preparation workflow | Live workflow and supplied-ledger audit passed; supported period is July 2024–June 2025 |
| Current-year filing production | Not supported by the supplied schedules; numeric salary bands remain absent |
| Deployment configuration gate | **Fails:** final HTTPS `AUTH_URL` and one legacy owner's password change |
| Git publication | No Git remote configured; release changes include modified and untracked files. No release commit, push or public repository was created |
| Hosted application and CI | No hosted workflow or GitHub CI execution verified; Docker daemon unavailable, so no fresh container build verification. CI/container source files exist |
| Browser and operational acceptance | No fresh browser/device matrix, hosted backup/restore, monitoring or public access verification claimed |
| Runtime dependencies | Zero runtime advisories; 13 developer-tool entries (nine high, four moderate) |

The code may be prepared for a staging review after setting the destination environment and credentials. It should not be presented as a verified public production deployment or current-year filing system. Hosting and publication were previously deferred; this request asks for assessment, not deployment.

## Fresh checks

| Check | Fresh result |
| --- | --- |
| Lint / TypeScript / whitespace / standalone production compilation | Pass |
| Unit tests | 27/27 |
| Live end-to-end workflow | 13/13 |
| Boundary / company-isolation checks | 9/9 |
| Supplied-ledger / live AI audit | **28/28** |
| Payment/reconciliation edge regressions | Pass |
| Release regressions | 11/11 |
| Income/sales approval concurrency and audit rollback | 6/6 |
| Duplicate-header rejection and corrected import | Pass |
| Exact-money integration | 9/9 |
| Both Excel date epochs, import rollback/retry and further mutation/audit recovery | Pass |

The quota assertion passed in this run. This does not rewrite the prior audit's 27/28 result or remove the timing window in its single-minute test setup. The current run verified live ledger review, missing-evidence assistance, action/link-request resistance and usable quota rejection. It is not an AI accuracy benchmark or availability guarantee.

**All rerun local suites passed; no new code defect was confirmed in this pass.** This includes duplicate-header rejection without writes, corrected-source import, exact cents, seven audited mutation rollback paths, stale-input rejection and successful recalculation/approval. No earlier failed run is rewritten by this fresh outcome.

The software has not been changed in this audit. The readiness decision remains blocked by the release and operational conditions even if all remaining local suites pass.

## Required before launch

1. The owner changes the remaining legacy password in Settings. The audit does not choose or change a human account password.
2. Configure the chosen HTTPS origin, production environment and a separate production database/runtime identity; apply migrations and confirm the release gate passes there.
3. Verify the hosted upload → AI suggestion → human approval → batch → export path, access isolation, recovery and provider failure behavior on that actual deployment. Verify the target's backup retention/restore and monitoring configuration.
4. State the historical scope prominently. To offer current-year calculations or salary withholding, obtain and verify the missing schedules before enabling those functions.
5. Prepare the intended source repository/release and verify what is included before publication. Local environment secrets and private backups are ignored; no tracked `.env*`, key or dump files were returned by the targeted check. That check is not a complete historical secret scan or a public-data redistribution review.

## Scope and evidence limits

The audit exercises synthetic fixtures and uses the supplied ledger in separate test companies. It makes no real payment or tax filing and does not modify supplied client workbooks. Live NVIDIA/Nebius integration requests consume credits. Fault-injection/concurrency tests run on the isolated `install_*` database configured privately at `/tmp/taxtech-fresh-env.json`; scoped triggers are removed and original rule edits restored. Final inspection confirmed zero remaining fault triggers and restored isolated rule rates of 4.000% income and 17.000% sales. The isolated test server was stopped; the main local app remains running.

No fresh contest eligibility/deadline review, external penetration test, AI accuracy benchmark or guarantee against undiscovered bugs is claimed. A usable AI response in these tests is not an availability SLA. The prior audit's minute-boundary quota-test timing issue remains relevant to interpreting that specific assertion.
