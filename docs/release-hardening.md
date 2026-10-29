# Code hardening and handover — October 20, 2026

> Historical report: findings below describe the dated run and are retained as evidence. Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

**Later work:** the [re-audit](re-audit-2026-10-20.md) found five additional gaps. See [their fixes and latest verification](re-audit-fixes-2026-10-20.md). This report records the preceding hardening pass.

The expanded audit's failing software paths have been repaired and retested. Publishing and deployment are explicitly deferred by the owner. This report distinguishes verified local code behavior from a public production release.

## Audit fixes

| Gap | Final behavior |
| --- | --- |
| Bulk AI output was truncated | The default NVIDIA Nano request disables thinking and permits 6,000 completion tokens. Live batches of 10, 10 and seven supplied entries passed. Truncated/malformed replies fail closed without saving partial financial decisions. |
| AI inferred a company vendor | Recipient-specific suggestions require explicitly confirmed recipient metadata. Imported vendor names and filer status alone do not count as recipient-type evidence. Missing or mismatching evidence changes the suggestion to no rule, zero confidence and clarification questions. |
| Missing vendor could not be resolved | Review entries can attach an existing company vendor or create a supplier from supporting evidence. Assignment is audited, clears old AI advice and reopens review. Foreign-company vendors and approved-period changes are rejected. |
| Empty sales-tax recalculation kept a positive draft | Recalculation atomically removes obsolete draft lines, items and batches when no eligible positive entries remain. Approved batches remain locked. |
| Runtime security advisories | Next.js, React, Auth.js, Drizzle and SheetJS were updated; the unused credential-auth adapter was removed and the shadcn CLI moved to development dependencies. The runtime dependency audit reports zero known advisories. |
| Proxy-only authorization | Every business API handler authorizes independently, and company pages check their own tenant access. The proxy remains a separate protection. Tests cover ordinary ownership checks and a foreign `.rsc` route. |
| SECP Edit Profile failed | PATCH edits preserve filed records and identifiers. Generated pending schedules reconcile by fiscal year; actual AGM dates drive dependent filings. |
| SECP used deadline as actual meeting date | New dependent filings are provisional until an actual AGM is recorded. The calendar supports first-AGM timing, month-end dates, event-based obligations, manually reviewed prerequisites and adding fiscal years. |
| Incorrect automatic penalty assumptions | AGM estimates use an entered officer count. The source's contingent beneficial-ownership penalty is not automatically accrued as a payable amount. Filed/waived and provisional rows do not accrue estimates. |
| Negative salary accepted | Server validation rejects negative/non-finite amounts, unsupported precision and unsupported tax years. Missing income remains distinct from zero. |
| Unsupported salary figures appeared authoritative | The provided workbooks contain no numeric salary slabs. Employee records remain available, while salary tax is explicitly unavailable. A validated, source-labelled schedule calculator is present for a later reviewed numeric schedule; no tax bands were invented. |
| Environment example was ignored | The secret-free `.env.example` is eligible for version control. Actual secrets and private backups remain ignored. |
| Upload retries were unclear | File selection resets reliably, errors remain visible, and preview no longer obtains a financial write lease. Invalid numeric/date text is rejected instead of partially parsed. |
| Shared legacy login | Password changes require the current credential, revoke existing sessions and record an audit event. Legacy short-password logins are restricted to changing their password. Login/password attempts are limited with shared database counters. The local session secret was strengthened. |
| Unsafe maintenance scripts | Seeding inserts missing reference categories without truncating or changing existing financial history. Destructive reset is gated and disabled in production. Private backup tooling is provided. |

## Verification completed

- Clean lint, TypeScript and **13 unit tests**.
- Production build with database, authentication and AI secrets absent from the build environment. Standalone output does not contain `.env.local`.
- Existing **13 end-to-end checks plus nine boundary checks** passed on the upgraded app.
- Expanded supplied-ledger audit: **28/28 checks passed**, including three live AI batches, assistant safety cases, company access, salary validation and clearing obsolete sales-tax drafts.
- **Eleven release regression checks** passed: missing suppliers through final batch approval; vendor assignment lock; SECP profile history; actual-AGM dates; event creation; security headers; foreign vendor rejection; foreign transport-route rejection; password-session revocation; recipient evidence independent of filer status; and legacy calendar reconciliation.
- A completely empty isolated Neon database installed from exported application schema, seeded and provisioned successfully. Repeated seeding preserved counts. Its separate application instance passed the full 13-check workflow with live Nebius calls.
- A private PostgreSQL backup of the synthetic installation was restored into another empty isolated database. Company, user, ledger, batch and audit counts reconciled. The user's business database was not restored over or cleared.
- 42 existing income categories were mapped to exact source rows. Configured numeric rates matched the mapped source values in the connected database. This is not an exhaustive determination of legal applicability; categories absent from supplied rate references cannot be calculated by the income engine.

Live tests consumed Nebius credits. Isolated synthetic companies, test databases and private test outputs were retained for inspection; they are not production data. The source ledger was not committed or used as a public demo asset.

## Limits that remain explicit

1. **Visual verification:** browser control was disabled in Work settings during this hardening pass. HTTP end-to-end tests and component builds passed; the newly added controls were not visually exercised in this pass. Earlier audit screenshots predate these changes.
2. **Tax data:** the owner chose the supplied historical reference workbooks as the release basis. They are preserved in `data/supplied-reference-data.json` with source hashes. This is Finance Act 2024 / Tax Year 2025 material, not a claim that rates apply to the current tax year. Salary lacks numeric source bands; tiered rent and other unsupported calculations fail explicitly. The app never files or pays tax.
3. **Legacy calendars:** existing filing history is preserved. Legacy rows without fiscal-year provenance are not silently rewritten by profile edits. Unfiled legacy rows are excluded from automatic penalty estimates and cannot be marked complete until reconciled using the source-evidence/date control on the calendar. This preserves history while providing a complete upgrade path. New calendars use the new explicit annual/event/provisional metadata.
4. **Development tooling:** the full npm audit still reports 13 advisory entries confined to development tools: glob/brace handling in the Next lint/shadcn chain and the old esbuild loader used by Drizzle Kit. No compatible patched upstream chain was available in this audit. These tools are not part of the standalone runtime. Do not run their development servers on a public interface or feed untrusted repositories/patterns to them. CI receives no production secrets. This is documented risk triage, not a claim of a zero-advisory development installation.
5. **Deployment:** the local release gate correctly remains false because `AUTH_URL` is localhost and one real legacy account still needs its owner to change its demo password. The code restricts that account and provides the password-change UI. Its human password was not changed on the owner's behalf.
6. **Scope of assurance:** no external penetration test, high-load endurance test, hosted verification or guarantee against every prompt-injection case is claimed. The Dockerfile and GitHub workflow are prepared; the Docker daemon was unavailable and the CI workflow has not run on GitHub.

## Run and verify

Use Node 22+, `npm ci`, then configure server-only values in `.env.local`. Existing database: `npm run db:review-migrate` applies additive fields/indexes and refuses conflicting unique-period data rather than discarding records. Empty database: `npm run db:push`, `npm run db:seed`, `npm run db:seed-st`, then provision a unique account with `npm run db:create-admin`.

`npm run build` creates the standalone bundle. `npm start` copies its public/static assets and listens on localhost. `APP_HOST` can explicitly select another binding; the supplied non-root container listens on its internal interface and expects runtime environment variables. No database connection or AI secret is necessary to compile.

Local verification commands:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run test:workflow
npx tsx tests/boundaries.integration.ts
npm run test:audit
npm run test:release
npm run release:check
```

Integration commands create isolated fixtures in the configured database and make paid/metered live AI requests. Use a test database. `test:release` follows `test:audit` and rotates only its temporary test user's password. Never publish files under `/tmp/taxtech-*`.

`npm run test:fresh` creates an isolated test database (requires database-creation permission). The fresh workflow runner and restore test under `scripts/` are opt-in test tooling. They never replace the existing database.

## Private backups and later deployment

`npm run db:backup` requires PostgreSQL client tools compatible with the server version. It writes a private custom-format archive to ignored `.backups/` by default; `BACKUP_PATH` can select a private destination. Files receive mode 600. Neon backup/restore operations use the direct host rather than the pooler. Store off-machine encrypted backups and verify the chosen retention policy before launch; no unattended backup schedule has been activated.

For deployment later: use a separate production database and strong unique account credentials; set the final HTTPS `AUTH_URL`, random `AUTH_SECRET` and server-only Nebius key; apply migrations with an administrative database identity, then use a restricted runtime identity; configure provider budget/usage monitoring and backups; run the release gate and hosted workflow. Application quotas are request limits, not a guaranteed dollar billing cap. Judge access, public repository, video and Devpost submission remain the publication phase the owner deferred.
