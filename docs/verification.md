# Local verification — October 20, 2026

> Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

**Latest result:** see [the final local readiness audit](final-readiness-audit-2026-10-20.md): fresh local suites passed, while deployment/account and tax-data conditions remain. This document records the earlier workflow verification.

The production build passed the full synthetic workflow against the configured Neon database and live Nebius NVIDIA Nemotron API. These tests consumed provider credits. Test accounts and financial records belong to isolated synthetic companies; existing business records were not edited by the integration tests.

## Completed checks

- Lint, TypeScript checking, production compilation and seven unit tests passed.
- Login; mapped ledger import; duplicate-file rejection; company isolation; viewer restrictions.
- Real AI classification and contextual assistance. Suggestions remain pending until a human decision.
- Human approval, vendor memory and exact decimal batch arithmetic; atomic draft recalculation.
- Approved-period locking; PDF generation; existing challan/payment history retained on regeneration.
- Invalid rule rejection; stale suggestion rejection; reopening restores the pending gate.
- Unknown vendor status blocks approval; held write lease blocks competing mutations; stale drafts cannot be approved.
- Desktop and narrow mobile review layout, upload/mapping/preview/import and mobile navigation inspected in the browser.

## Release and submission limits

- Existing tax, salary and compliance schedules still need professional verification for the applicable tax year. No tax-accuracy benchmark or measured time-saving claim has been established.
- Rotate the existing legacy demo administrator password before any public deployment. Provisioning now requires a unique password; existing credentials were deliberately left unchanged.
- A public repository, hosted judge demo, YouTube video and completed Devpost submission are still required. See `hackathon-submission.md`.
- AI quotas count requests, not dollars. Provider billing controls and sufficient credit through judging still need operator monitoring.
- Tests establish the listed local behavior, not a certified filing service or a completed public release.
