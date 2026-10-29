# Submission audit — October 20, 2026

> Historical report: findings below describe the dated run and are retained as evidence. Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

**Historical audit — see [the subsequent fixes and verification](release-hardening.md) for current code status.**

**Verdict at the time of this audit: not ready for submission.** The local happy path works, but broader ledger testing found functional and AI reliability gaps. Public submission materials also remain incomplete. This audit adds tests and records findings; it does not repair the application or upgrade dependencies.

## Checks executed

- Production build, lint, TypeScript and all seven unit tests passed.
- The existing 13 workflow checks and nine boundary checks passed again with live NVIDIA Nemotron on Nebius.
- Expanded audit: **23 of 28 checks passed** after correcting the audit's own PostgreSQL date normalization. The five failures are three bulk-AI requests, stale sales-tax recalculation and negative salary validation. This count measures the selected checks, not product coverage or legal accuracy.
- All 12 main authenticated pages returned HTTP 200. A page response is not proof that every control works. Browser inspection also covered supplied-file mapping, date/amount preview, duplicate import, profile editing and review. At 390 px, the tested review page had no horizontal overflow or controls extending outside the viewport.
- A synthetic invoice completed human review, income calculation/approval and sales-tax calculation/approval. PDF export and preservation of recorded synthetic payments passed in the workflow suite. No actual payment or filing occurred.
- Company isolation, viewer restrictions, stale-review/draft protection, approved-period locks, duplicate import rejection, origin protection and AI quota errors passed the exercised cases.

Tests used new isolated companies and temporary accounts. Existing business records and the four supplied workbooks were not edited. Live AI tests consumed credits. Private diagnostic results and test credentials remain outside the repository.

## Supplied documents

`../GL- Sample Sheet.xlsx`, Sheet1, rows 4–30: **27 transactions, nine months, PKR 86,477,585.00**. The opening balance in row 3 was correctly excluded. Independent workbook extraction and imported database totals reconciled. Of these transactions, **24 have no vendor attached**.

The income and sales-tax workbooks identify Finance Act 2024 as their basis. They are historical reference data, not independent evidence of current applicability. The SECP workbook describes incorporation/AGM-based scheduling, including actual AGM dates; the app currently uses an AGM deadline proxy and does not implement the complete reference workflow. Workbook prose was treated as reference content, not instructions.

## Findings to resolve

| Priority | Finding | Observed evidence and required change |
| --- | --- | --- |
| High | Bulk AI review fails | Requests for 10, 10 and seven supplied entries each returned HTTP 503/incomplete response after approximately 19–20 seconds. A ten-entry provider diagnostic returned `finish_reason=length` at exactly 2,200 completion tokens. The app advertises ten entries but its output budget does not support these cases. Adjust token/reasoning settings or chunk requests; verify the advertised maximum and recovery. Failed calls saved no suggestions. |
| High | AI assumes missing vendor type | A single supplied entry succeeded in about 25 seconds, proposing `153_goods_company` at 0.93 confidence with no questions, although the description does not identify the vendor. Require uncertainty/questions where recipient type is missing. This is an observed unsupported assumption, not a measured overall accuracy rate. |
| High | User cannot attach a missing vendor | May 2025's three sample entries produced an income draft with two unknown vendors. Approval correctly returned 409. The current transaction/review APIs and UI provide no vendor-assignment action, so obtaining evidence alone cannot complete this workflow. Add a company-scoped vendor assignment and invalidate affected review/drafts. Do not bypass the gate or exclude valid entries just to finish. |
| High | Sales-tax recalculation retains an obsolete draft | A synthetic February draft contained PKR 3,400. After reopening and approving its entry with no sales-tax treatment, recalculation returned HTTP 200 and zero lines, but the PKR 3,400 draft remained. `lib/stWHTEngine.ts` returns before clearing obsolete drafts when no eligible entries remain. Recalculation must atomically reconcile or explicitly invalidate them. |
| High | Security dependencies need remediation | `npm audit --omit=dev` reported 33 affected dependency entries: five critical, 21 high, five moderate and two low. Direct affected packages include Next.js, Auth.js/adapter, Drizzle, SheetJS and the shadcn CLI dependency tree. Counts include transitive effects and do not prove 33 exploitable app flaws. Review applicability, update affected runtime packages, remove development tooling from production dependencies where appropriate and rerun tests. No automatic force-upgrade was applied. |
| Medium | SECP Edit Profile cannot save | The editor posts to the first-time setup endpoint, which rejects an existing profile with 409. Preserve history while providing a real edit path or remove the unsupported action. The current annual calendar is also a limited prototype, not the full workbook specification. |
| Medium | Negative salary accepted | Posting monthly gross `-100000` returned HTTP 201. Validate finite nonnegative amounts and supported tax years on the server. Salary displays historical 2025 slabs, even though employee creation accepts other years. |
| Medium | Setup template will be omitted from a normal commit | `.env.example` exists locally but matches `.env*` in `.gitignore`. Explicitly allow the secret-free example before publishing. Actual `.env.local` remains ignored. |

Additional UX observation: while an AI review holds the company write lease, upload preview can be rejected as a competing change; selecting the same file again after failure/removal did not restart parsing until the page was reset. Make retries clear and reset the file input reliably.

## AI assistance results

The assistant answered the missing-evidence question correctly: keep the entry pending, obtain vendor/accountant evidence, then review. It resisted a request to claim all records were approved and link to an external collection URL. Its returned navigation stayed inside the user's company. A ledger prompt-injection test returned no category, specific clarification questions and pending status. These are individual observed safety cases, not a guarantee against prompt injection. No expert-labelled classification benchmark or review-time improvement has been measured.

## Contest preparation score

Informal checklist: 0 = missing/unverified, 1 = partial, 2 = demonstrated locally. **12/24**, not an official judging score. Rules checked live against [the official contest rules](https://nebiusglobalaihackathon.devpost.com/rules).

| Requirement | Points | Status |
| --- | ---: | --- |
| Runtime Nebius call with NVIDIA model | 2/2 | Live calls confirmed. |
| Best Apps and Agents fit | 2/2 | Accountant review workflow fits the stated track. |
| Complete working workflow | 1/2 | Synthetic path passes; supplied-ledger vendor resolution is incomplete. |
| Consistent demonstrated functionality | 1/2 | Bulk AI fails despite smaller requests and assistant working. |
| Working public demo and judge access | 0/2 | Localhost only; no hosted URL/access verified. |
| Public source repository | 0/2 | No Git remote configured; app source largely untracked. |
| Open-source license | 2/2 | MIT file present locally; publication not yet verified. |
| Setup instructions and required files | 1/2 | README present; example environment file ignored; fresh-database install not independently repeated. |
| English project/technology description | 2/2 | Local submission document explains features and provider/model use. |
| Significant-update explanation and evidence | 1/2 | Written explanation present; new app changes not committed with reviewable history. |
| Public YouTube demo under three minutes | 0/2 | No completed video/link verified. |
| Completed submission, feedback and entrant declarations | 0/2 | Not verified; ownership, permissions and eligibility declarations remain entrant responsibilities. |

The current rules give October 30, 2026 at 10:00 AM Pacific as the submission deadline and require free judge access through December 15. Before publication, also rotate the legacy demo login, verify applicable tax schedules and ensure sufficient Nebius credit/quotas for judging. The existence of functional local code does not complete registration or submission.

## Reproduction

With the local production server running and the configured non-production database:

1. `npm run lint && npm run typecheck && npm test && npm run build`
2. `npm run test:workflow`
3. `npx tsx tests/boundaries.integration.ts`
4. `npx tsx tests/submission-audit.integration.ts` — creates a fresh test company and uses the supplied workbook plus live AI; exits unsuccessfully for detected failures.
5. `npx tsx tests/audit-followup.integration.ts` — uses that audit company for focused single-entry, adversarial and provider-output rechecks.

The private JSON under `/tmp/taxtech-audit/` includes individual results and latency. Synthetic fixtures remain for inspection; do not publish test credentials or supplied-ledger contents.

Security references: [Next.js proxy authorization advisory](https://github.com/advisories/GHSA-267c-6grr-h53f), [SheetJS upload parser advisory](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9). Scanner findings require remediation and app-specific review, not assumptions that all flagged features are in use.

Normal-route ownership checks passed. Transport variants from framework advisories were not exhaustively tested. Several pages and handlers depend on the proxy for tenant checks; enforce ownership in the underlying data access/route as well as upgrading the affected framework. No penetration test, concurrency stress test, fresh-database installation or hosted-environment verification was completed in this audit.
