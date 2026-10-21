# Vercel deployment

Published on October 21, 2026: [live application](https://taxtech-zeta.vercel.app) and [public source repository](https://github.com/muhammadabdulrafay63-sudo/taxtech). GitHub, Vercel and Neon ownership were confirmed as Abdul Rafay. See [hosted release verification](production-release-2026-10-21.md). The steps below document the deployment procedure for future releases.

## Account and source setup

- GitHub owner: `muhammadabdulrafay63-sudo` (Abdul Rafay). Preserve the existing history and the separate runtime, backend, workspace, regression and documentation commits.
- Verify Abdul Rafay's Vercel workspace and Neon project in their dashboards before linking them.
- Publish the reviewed source with its MIT license. Environment files, backups, original business ledgers and temporary integration fixtures stay private.
- Import the GitHub repository into Vercel as Next.js. Select Node 22, use `npm ci` and `npm run build`, and leave the framework's output and start settings automatic. The standalone start script is for local/container operation.

## Database and secrets

Create a separate production database in the verified Neon account. Do not deploy against a database containing synthetic audit fixtures. Initialize an empty database from the current schema (`npm run db:push`), seed the historical reference rules, and create a unique administrator using `npm run db:create-admin`. Do not automatically run schema changes on every web build. Existing installations instead need the documented additive upgrade procedure and a verified backup.

Use an administrative connection only for setup. Give the runtime role the table/sequence privileges needed by the app, without schema ownership or database-creation rights. Set the runtime connection as Vercel's server-only `DATABASE_URL`. Keep preview deployments on a separate database and secret.

Configure these project environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Private production Neon runtime connection |
| `AUTH_SECRET` | A new random production secret |
| `AUTH_URL` | The stable HTTPS production origin, without a path |
| `NEBIUS_API_KEY` | The owner's server-only Token Factory key |
| `NEBIUS_MODEL` | An available NVIDIA model; default listed in `.env.example` |
| `AI_DAILY_REQUEST_LIMIT` | The selected company request allowance; default 100 |

Do not configure `ADMIN_PASSWORD` in the deployed application after account provisioning. Never prefix secrets with `NEXT_PUBLIC_`. Confirm provider budget controls and database restore/retention settings in the owner's accounts before opening access.

## Hosting constraints and verification

Vercel limits function request and response payloads to 4.5 MB. The app caps ledger files at 4 MiB (labelled 4 MB) to leave multipart overhead; browser and both upload endpoints enforce the cap. Larger uploads require splitting the ledger or a future private object-storage upload flow. Source: [Vercel Functions limits](https://vercel.com/docs/functions/limitations#request-body-size), checked October 20, 2026.

Before treating the deployment as ready, confirm successful GitHub checks and the actual Vercel build, then test the hosted login, first-run tour, synthetic ledger preview/import, live AI review, explicit human approval, draft/approval/PDF path, assistant and session logout. Run `release:check` against the production configuration; never run fixture-creating integration suites in the production database. Verify denied anonymous/foreign-company access and inspect provider logs for errors without logging secrets or ledger contents.

The release remains limited to July 2024–June 2025 source schedules. Numeric salary tax and tiered rent remain explicitly unavailable. A successful deployment does not validate current-year tax applicability.

Rollback means returning Vercel to a previously verified deployment. Database changes require their own backup/restore plan; rolling back application code does not undo stored financial changes.
