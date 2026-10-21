# Client operations

## Backup and recovery

`Encrypted database backup` runs on GitHub Actions every six hours, at minute 43. Each run uses a dedicated SELECT-only Neon role, takes a PostgreSQL 18 custom-format snapshot, and restores it into disposable PostgreSQL 18 before encrypting it with age. Only ciphertext and its checksum manifest are uploaded. Artifacts expire after 90 days. GitHub scheduling is best effort; six hours is the target interval, not an SLA. Public-repository schedules can be disabled after 60 days without repository activity: review workflow activity weekly and before onboarding.

The encryption recipient is public. The private recovery identity is **not** in Git, an artifact or the app environment. The owner must keep a second copy in a secure password manager/offline recovery location. Losing every private identity copy makes the backups unrecoverable. Download the newest successful encrypted artifact from Actions. Verify its SHA-256 against the manifest, then decrypt locally:

```sh
age --decrypt --identity /private/path/backup-recovery-key.txt --output /private/path/recovery.dump /private/path/database.dump.age
```

Restore into a **new empty** database using PostgreSQL 18 `pg_restore --no-owner --no-acl --exit-on-error`. Use PostgreSQL environment variables/private connection storage for credentials. Compare counts and test sign-in before deliberately switching an environment to the recovered database. Never run a blind restore against production. Repeat a recovery drill monthly. Neon’s six-hour history is an additional short recovery window, not this off-site backup policy.

The `production-operations` GitHub environment is restricted to `main`; it contains only the backup-reader connection and monitoring token. PR workflows do not request these secrets. Review changes to operations workflows before pushing them to main.

## Health, errors and usage

`Production health and usage` checks the login, authentication endpoint, database, aggregated server/AI errors and daily application AI quota about every 15 minutes. A daily tiny synthetic inference checks that Nebius still accepts requests, including billing/credit entitlement. It never sends a ledger or client prompt. GitHub failure notifications go to the account that owns/last changes the schedule. Confirm Actions email notifications remain enabled. An optional manual `alert_test` run deliberately fails to test delivery without affecting the app.

`/api/health` exposes only liveness anonymously. Database readiness and aggregate operational counts require a long bearer monitoring token. No stack trace, prompt, URL, client identity or ledger value is stored by operational counters. Next request exceptions and provider failures are counted; business validation failures and browser-only failures are not a complete error telemetry system. Retain Vercel logs for investigation and consider a dedicated error tracker if incident volume warrants one.

The app has both per-company and deployment-wide daily request ceilings. Alerting starts at 80% of the deployment-wide ceiling. These ceilings **are not a dollar cap or a live account-balance measurement**. Nebius billing must also be reviewed for available funds and credit expiry; no supported numeric balance API was established. Provider billing notification settings and sufficient credit remain account-owner responsibilities.

## Isolated previews

The `codex/staging` branch deploys to Vercel Preview using a separate Neon database and database role, a different authentication secret, and a synthetic-only company/account. Production records were not copied. The two databases share the existing Neon project/compute and have separate table permissions. Preview uses the existing Nebius provider account with lower request allowances, so it shares provider credits. Keep Vercel authentication protection enabled for previews. Never use original client ledgers in this environment.

Before promoting a release, run lint/type checking/unit tests/build and the synthetic upload → live AI review → approval → batch workflow on Preview. Push reviewed release commits to main to deploy production; retain a known-good deployment for rollback. Apply additive migrations to each database with an administrative connection before deploying code; runtime credentials cannot migrate schemas.

## Commercial and tax gates

Vercel Hobby is restricted to personal, non-commercial use. Upgrade to an appropriate commercial plan before serving paid/client business usage; no upgrade or paid subscription is authorized by this setup.

The active calculation window remains July 2024–June 2025. Official current-year reference discovery is documented separately. Discovery of a new rate card does not make the existing unversioned rule master suitable for another tax year. Do not expand the supported period without reviewed, versioned income/sales schedules, source evidence, boundary tests, and historical-batch regression checks.
