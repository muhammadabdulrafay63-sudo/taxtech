# TaxTech — AI-Assisted Withholding Tax Preparation

[Open the live app](https://taxtech-zeta.vercel.app) · [Hosted release verification](docs/production-release-2026-10-21.md) · [Client readiness](docs/client-readiness-2026-10-21.md)

Withholding-tax preparation software for accountants in Pakistan. AI-assisted ledger review is a step in the preparation workflow. Upload Excel/CSV, review unclear entries with NVIDIA Nemotron, approve the tax treatment, and calculate an income or sales-tax draft batch. An in-app assistant explains the current page and next steps.

## Tax-year configuration

This demo is configured for FY2024–25 (Tax Year 2025), July 2024–June 2025. Tax constants can be modified for any tax year, together with that year’s applicable rules, thresholds, salary bands and effective dates. A developer must update and validate the configuration before enabling that year; changing rates in the admin screen alone does not enable another year. This demo does not provide a tax-year switch or simultaneous multi-year schedules. See [configuration instructions](docs/tax-year-configuration.md).

## Start locally

Requires Node.js 22+, npm, a Neon PostgreSQL database and (for AI) a Nebius Token Factory API key.

1. `npm ci`
2. Copy `.env.example` to `.env.local`. Configure `DATABASE_URL`, `AUTH_URL=http://localhost:3000` and a random `AUTH_SECRET` (generate with `openssl rand -base64 32`). Never commit this file.
3. **New empty database only:** `npm run db:push` creates the full schema. **Existing TaxTech database:** `npm run db:review-migrate` adds the review, import-receipt, quota and write-lease fields/tables without deleting records. Existing transactions become pending and require review.
4. For a new database, `npm run db:seed` and `npm run db:seed-st` load the reviewed TY2025 calculation cases. The seed scripts insert missing categories and preserve existing rules and financial history. They never truncate tables. On an existing installation, run `npm run db:ty2025-migrate` with an administrative database connection after taking a backup. It upgrades the stored configuration, retires unsupported categories, adds invoice assessments and reopens only unlocked legacy decisions. See [TY2025 scope and migration](docs/ty2025-configuration.md).
5. Set `ADMIN_EMAIL`, a unique `ADMIN_PASSWORD` (12+ characters), and optional `ADMIN_NAME` / `COMPANY_NAME` in `.env.local`. Run `npm run db:create-admin`. Existing accounts are left unchanged. Legacy short passwords are restricted to Settings until the user changes them; password rotation revokes all earlier sessions. Remove `ADMIN_PASSWORD` from the environment after provisioning.
6. Set `NEBIUS_API_KEY` and optionally `NEBIUS_MODEL`. The default is `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`; use a currently available NVIDIA model from your Token Factory catalog. AI requests go to `https://api.tokenfactory.nebius.com/v1/chat/completions` on the server.
7. `npm run dev` and open http://localhost:3000. Sign in with your configured account. Production: `npm run build` then `npm start`.

## Hackathon judge demo

The dedicated judge account has a completed synthetic example, repeatable practice and in-app instructions. Credentials are supplied separately to judges and are never committed. See [judge testing](docs/judge-testing.md) and [technical submission copy](docs/devpost-submission-copy.md). `scripts/provision-judge-demo.ts` is an explicit synthetic-only operator tool, not an automatic production seed.

## Try the complete workflow

1. Download **synthetic sample ledger** from Upload, or use `public/sample-ledger.csv`. Its dates are June 2025, within the supported schedule window.
2. Upload, select a sheet, verify distinct column mappings, preview and import. ISO and day/month/year dates are supported. Files are limited to 4 MB / 5,000 valid entries. Opening balances, zero and invalid-date rows are skipped; the response reports how many. Re-importing the same sheet with the same mappings is rejected.
3. Open **Review ledger**, choose June 2025 for the sample (or your ledger’s supported month) and request AI review for unclear rows. Each request covers up to 10 entries on the current page. Account mappings and remembered vendor preferences provide other suggestions; every row still needs a human decision.
4. Read each explanation and missing-information question, verify the evidence, choose **both** income and sales-tax treatment, enter the correct invoice bases, confirm historical eligibility, write a note identifying the evidence, and approve or exclude. Section 153 income gross includes sales tax. Sales-tax value excludes tax and the invoice must state the tax separately. Unsupported taxable cases must remain pending for specialist assessment. "Not applicable" is an explicit treatment, not a missing approval. Optional vendor memory applies only after approval.
5. Attach a missing supplier from the review entry (or create one from evidence). Vendor assignment reopens review and clears old AI advice. In Vendors, explicitly confirm recipient type; filer status alone does not establish it.
6. Generate an income draft from the review screen; sales-tax drafts are generated from Sales Tax WHT. All entries in that month must be reviewed. Excluded entries do not participate. Non-positive amounts are not treated as positive expenses. Salary has a separate TY2025 estimate module with verified bands and the surcharge. Annual individual/AOP rent is outside the vendor engine; the flat rent case requires a company landlord. Only specifically reviewed invoice-based sales-tax cases are enabled, with no blanket registration fallback.
7. Inspect draft lines. Resolve unknown vendor status in Vendors and recalculate before approval. Approved periods are immutable. Generate internal PDF challan summaries from an approved income batch. Recording a CPR marks a payment that happened externally; the app never pays or files taxes.
8. Use **Ask TaxTech** from any dashboard page. Local page guidance works without AI. Upload/calculation errors and invalid form fields surface a help cue; nothing is sent to AI until the user asks.

## AI, privacy and cost controls

- Both features make real runtime calls to NVIDIA Nemotron through **Nebius Token Factory**. No GPU deployment, fine-tuning, vector database or additional AI provider is required.
- Ledger review sends descriptions (up to 1,200 characters), account codes and the configured rule catalog. It does not send the raw ledger, tax IDs, amounts or vendor records. Descriptions can still contain private information: use synthetic data for a public demo and only submit authorized data.
- Suggestions are schema-validated, checked against the supplied row IDs and active rule keys, persisted with model and time, and never change approved categories. Confidence is model-reported, not measured accuracy. Audit records capture human decisions.
- The assistant sends the question, current page, optional generic error cue, six recent chat messages and aggregate company counts. It returns only allowlisted internal navigation links. It cannot run actions. Chat stays in component memory and resets on navigation.
- Keys stay server-side. Daily company quota defaults to 100 AI requests and a separate per-user/per-feature limit of 5/minute. Each request has a 45-second timeout and 6,000-token output ceiling (thinking disabled for the default Nano model). Quotas count attempts. These limits reduce spend; they are not a guaranteed dollar billing cap. Configure provider-side controls and monitor credit usage as well.
- Company ownership and viewer permissions are enforced before data access. Database-backed leases serialize company writes; transactional batch replacement preserves the old draft on failure. AI failures leave financial decisions unchanged and manual review available.

## Guided app tour

A six-step tour opens once per signed-in account, after any required password change. Use **App tour** in the top bar to replay it. First display is saved server-side across sessions/devices. It supports Next, Back, Skip and page shortcuts, and uses read-only guidance for viewers. See [feature verification](docs/app-tour-2026-10-20.md) and [the hosted browser checks](docs/production-release-2026-10-21.md).

## Verification

- `npm test`: parser, access/review policy, AI response validation and provider failure contracts.
- `npm run lint`, `npm run typecheck`, `npm run build`.
- `npm run test:workflow`: opt-in integration test against a running local app. Creates a separate synthetic company and random temporary account in the configured database; it performs live Nebius calls and consumes a small amount of credits. No existing company records are modified. See the script for scope. Do not use a production database.
- `npx tsx tests/boundaries.integration.ts`: additional access, concurrency, stale-review and approved-period checks using that synthetic fixture. Run after the workflow test.
- See `docs/verification.md` for the checks completed locally and remaining release work.
- Latest release assessment: [hosted production release](docs/production-release-2026-10-21.md), with live AI/workflow checks, browser verification and explicit supported scope. Earlier assessment: [final local readiness audit](docs/final-readiness-audit-2026-10-20.md). Latest fix: [duplicate-column repair](docs/audit-round-7-fixes-2026-10-20.md), with shared preview/import rejection of ambiguous headings. Previous fixes: [exact-money repair and verification](docs/audit-round-6-fixes-2026-10-20.md), covering both import defects and related calculations, summaries and exports. Previous fixes and verification: [fifth-audit approval fix](docs/audit-round-5-fixes-2026-10-20.md), covering income/sales approval and global rule edits. Previous import fixes and verification: `docs/audit-round-4-fixes-2026-10-20.md`. Previous fixes and supported periods: `docs/audit-round-3-fixes-2026-10-20.md` and `docs/re-audit-fixes-2026-10-20.md`.

## Release preparation

See [the hosted release report](docs/production-release-2026-10-21.md) for the current deployment and verification, `docs/audit-round-7-fixes-2026-10-20.md` for the mapping repair, `docs/audit-round-6-fixes-2026-10-20.md` for the precision repair, `docs/audit-round-5-fixes-2026-10-20.md` for the approval fix and `docs/release-hardening.md` for private backups and the later deployment checklist. Calculations and final batch approval support July 2024 through June 2025 only; other periods need reviewed source schedules. Missing recipient evidence blocks approval. Reconciliation includes partial payments and separates drafts from approved liability. Build secrets are unnecessary. `npm start` runs the standalone server bound to localhost; use `APP_HOST` only when an intentional external listener is needed. A non-root Docker runtime and CI checks are provided; the application is published on GitHub and Vercel under Abdul Rafay’s accounts. See [Vercel deployment](docs/vercel-deployment.md).

Money in API calculation totals is returned as exact decimal strings. Imports reject invalid amounts without partial saves; large Excel amounts must be text.

## Important scope

This application supports human-reviewed withholding-tax preparation; it is not certified filing software. The enabled cases are scoped to July 2024-June 2025 and reconciled with historical official sources, with explicit applicability checks and exclusions in [the configuration notes](docs/ty2025-configuration.md). They do not cover all possible TY2025 transactions or the current year. Salary values are estimates, not payroll true-ups. The app does not query live FBR/ATL status, submit returns or generate an official payment instrument. Accountants must verify applicability and source evidence. AI interprets descriptions; arithmetic uses stored deterministic rules. A company's data remains isolated even for its administrator.

## Hackathon

Intended track: **Best Apps and Agents**. See `docs/hackathon-submission.md` for the project description, substantive changes, demo script and remaining external submission steps. License: MIT. Dependencies retain their own licenses; review `docs/third-party-notices.md` before publication.
