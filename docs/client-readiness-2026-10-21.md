# Client readiness follow-up — 21 October 2026

## Completed and verified

- Four scoped implementation/documentation commits added scheduled encrypted off-site backups, production health checks, handled API error counters, a deployment-wide AI quota and isolated Preview configuration. The sample ledger was corrected to June 2025 and now has a regression test.
- `Encrypted database backup` passed twice, including an isolated PostgreSQL 18 restore before upload. The downloaded first encrypted artifact passed checksum validation, local decryption and archive inspection. Only encrypted database data is stored in GitHub artifacts, with 90-day retention. The decryption identity remains private on the owner's machine; the owner confirmed saving a separate recovery-key copy.
- The backup Neon role was checked to have SELECT on application tables and no INSERT/UPDATE/DELETE privileges. Production runtime access remains separate from administrative setup.
- `Production health and usage` passed after deployment, including a small live inference. Anonymous and invalid-token health calls returned liveness only. An intentional failed run generated an actual email in Abdul Rafay's Gmail; the failure was a notification test, not an app outage. A subsequent normal monitor passed.
- The isolated Preview database contains only the testing company/account and four synthetic ledger entries. Its role was checked unable to SELECT production users or ledgers. Preview sign-in, upload, live AI review, separate human decisions and deterministic batch generation succeeded. The June 2025 draft was PKR 6,800 on PKR 85,000. Preview requires Vercel authentication and shares no production database credential or authentication secret. It shares the Nebius provider account with lower application quotas.
- Final hosted synthetic regression passed login, import/duplicate protection, tenant isolation, real AI review and assistance, human approval, batch arithmetic, recalculation, period locks, PDF output, payment-history preservation and viewer write rejection. Its temporary production fixture was removed; production returned to one company, one user, no ledger entries and no batches.
- Lint, type checking, 29 unit tests, runtime dependency audit and production build passed in GitHub CI. The production configuration check passed. Integration verification confirmed that API 5xx responses increment the error counter, validation errors do not, and the global AI ceiling returns 429 when exhausted.
- Nebius zero data retention was enabled. A daily Codex follow-up checks credits and backup/monitor freshness and stays quiet unless action is needed. This requires the desktop app/browser session; browser access subsequently became unavailable to the tool, so that browser-dependent check is not a substitute for the cloud monitor.

## Not complete

**Historical tax accuracy is not yet cleared.** The owner subsequently accepted a release restricted to 1 July 2024–30 June 2025 (Tax Year 2025), across the five requested authorities. TY2027 is outside this release. The historical period gate remains appropriate, but a fresh historical-source review found material differences even within TY2025: see `tax-year-2025-review.md`. Matching the supplied workbooks and passing workflow tests do not establish tax accuracy. Rule reconciliation, applicability checks and end-to-end verification against authoritative historical sources remain required before client tax calculations are described as ready. The earlier `current-tax-reference-review.md` remains future-scope research, not the acceptance standard for this release.

The owner confirmed saving a second recovery-key copy outside this Mac. The local key remains at `.backups/backup-recovery-key.txt`, excluded from Git and protected locally.

Vercel remains on Hobby as requested. A free account can host a public site. Vercel's published terms restrict Hobby to personal non-commercial use; no Pro upgrade, paid add-on or new card was added. Commercial-client eligibility is separate from whether the website is publicly reachable.

## Operational limits

Six-hour backups and roughly 15-minute monitoring use best-effort GitHub schedules, not an SLA. Public repository schedules can be disabled after inactivity. The daily browser credit check can alert about access problems but cannot read billing when the signed-in session or browser permission is unavailable. Daily request ceilings are not currency caps. No external security assessment, load-test guarantee or current-tax-year certification is claimed.
