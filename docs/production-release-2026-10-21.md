# Hosted release — October 21, 2026

**Later operational setup:** see [client readiness follow-up](client-readiness-2026-10-21.md) for scheduled encrypted backups, tested alerts, the separate Preview database and the current-year tax gap. The original verification below records the initial hosted release.

TaxTech is published at **https://taxtech-zeta.vercel.app**. Source: [muhammadabdulrafay63-sudo/taxtech](https://github.com/muhammadabdulrafay63-sudo/taxtech). GitHub, Vercel and Neon account ownership was verified as Abdul Rafay before publishing.

## Release configuration

- Existing Git history was preserved. Runtime setup, backend workflows, workspace/tour, regression tooling, documentation and Vercel upload compatibility were committed separately. Two hosted defects received their own fix commits: authentication host detection (`6307c00`) and the account menu's required Base UI group (`4c7178b`).
- Vercel imports the existing GitHub repository and deploys `main`. The GitHub app is restricted to TaxTech. The project uses the existing Hobby workspace; no paid add-on or custom domain was purchased.
- A separate, empty production database was initialized in Abdul Rafay's existing Neon project. The owner has a unique generated password. Business ledgers and earlier audit databases were not copied into it.
- Runtime database access permits application table operations, with no superuser, role creation, database creation or public-schema object creation privileges. Administrative setup credentials are excluded from the web deployment.
- `DATABASE_URL`, `AUTH_SECRET` and `NEBIUS_API_KEY` are Vercel Secrets. These and the three configuration variables are scoped to **Production only**. The initially imported defaults were corrected before final verification; the runtime database credential was refreshed. Preview deployments have no production database or AI credentials and need a separately configured test environment before runtime testing.
- Private login details, environment files and database backups remain outside Git in ignored local storage. No secrets or original client ledgers were published. The Nebius key was matched to the existing TaxTech key created by Abdul Rafay.

## Verification completed

- [GitHub checks](https://github.com/muhammadabdulrafay63-sudo/taxtech/actions/runs/39560793018): lint, TypeScript, 27 unit tests, runtime dependency audit and production build passed. Runtime audit: zero known vulnerabilities. The earlier development-tool advisory triage remains documented in `release-hardening.md`.
- The hosted synthetic API workflow passed login, ledger preview/import, duplicate rejection, foreign-company rejection, live NVIDIA/Nebius review, suggestions remaining pending, contextual assistance, human approval, vendor evidence, deterministic calculation, recalculation without duplicate batches, approved-period locks, PDF output, preservation of synthetic CPR history and viewer write rejection. No external payment or filing occurred.
- Browser verification passed first-run tour display, all six steps, Back, Finish, replay, Skip, no automatic reopening after reload or another sign-in, assistant response rendering, account menu opening and sign-out. The tour preference had exactly one stored event for the test account. The account-menu check was repeated after its fix deployed.
- Anonymous assistant access returned 401. The hosted login returned 200 with frame protection and `nosniff` headers. The production configuration gate passed.
- A private PostgreSQL 18 backup was restored into a separate empty database. Counts matched: one company, one user, 45 income rules and 26 sales rules. The production database was not restored over. Synthetic hosted test companies and their financial records were removed after testing.

## Supported scope and operations

This release supports the supplied **July 2024–June 2025** reference period. Numeric salary slabs and tiered rent remain unavailable where the supplied evidence is insufficient. It does not certify current-year tax rates, file returns or make payments. AI suggestions require human review.

Ledger files are limited to 4 MiB (displayed as 4 MB), below Vercel's request payload limit including ordinary multipart overhead. Larger ledgers need smaller files or a future private object-storage upload flow.

Neon's displayed history retention was six hours. A local backup/restore test is complete; no scheduled off-machine backup service or longer retention plan was activated. Monitor provider usage and maintain private backups as real data is added. Company request quotas reduce AI usage but are not a guaranteed currency spending cap.

This is a published, verified application release. Hackathon demo video, judge access and the actual contest submission are separate external deliverables; this report does not claim they were submitted. Hosting verification also does not replace an external security assessment or high-load test.
