# Third audit — October 20, 2026

**Subsequent fixes:** see [the implementation and verification report](audit-round-3-fixes-2026-10-20.md). The findings below describe the audited state before those changes.

**Verdict: not yet production-ready.** The previous five fixes continue to pass their regressions. Additional failure-path testing reproduced one high-priority financial-integrity bug and one medium-priority settings bug. This audit changes tests and documentation only; it does not repair application behavior or publish/deploy anything.

## New findings

### High: a failed vendor update can leave an unaudited change and allow approval at the old rate

The vendor update and its audit insert are separate database writes (`app/api/vendors/[id]/route.ts:58–78`). Approval uses the audit history to detect changes since calculation; its independent evidence check validates that filer status is known, but does not compare the saved line's filer status/rate to the supplier's current values.

In a separate isolated `install_*` test database, the probe:

1. Created a verified filer supplier and a reviewed PKR 100,000 goods entry, then calculated a PKR 4,000 draft.
2. Temporarily injected a failure for that synthetic company's `UPDATE_VENDOR` audit insert only.
3. Changed the supplier to non-filer through the API. It returned HTTP 500, but `is_filer=false` persisted and no audit row was saved.
4. Approved the existing draft through the normal API. It returned HTTP 200 and retained PKR 4,000, while the configured non-filer rate required PKR 8,000 for this synthetic entry.

The trigger and function were removed in `finally`. This is a reproduced failure-handling defect, not evidence that an outage or incorrect approval occurred in real company records. No real company, tax payment or filing was involved.

**Required fix:** commit supplier updates and their audit records in one transaction; apply the same review to other financial mutation paths with separate audit writes. At final approval, compare calculated input versions/status/rates against the relevant current values or an immutable validated snapshot so a missing audit event alone cannot certify freshness. Add a regression that forces the audit insert to fail and checks rollback and approval behavior.

### Medium: optional paid-up capital cannot be cleared

The API schema permits `paidUpCapital:null`, but the update converts null to `undefined` (`app/api/company/[id]/route.ts:51–53`). A synthetic company started with PKR 250,000. Sending `{paidUpCapital:null}` returned HTTP 500 and retained PKR 250,000. Sending an unchanged company name alongside null returned HTTP 200 with `ok:true`, while PKR 250,000 still remained in the database. The settings form sends null when the field is emptied, so this also reproduces the form's false-success path.

**Required fix:** distinguish an omitted property from explicit null. Save null when the user clears the field, keep an omitted property unchanged, and verify both the minimal API request and a complete settings-form request with a database assertion.

## Verification

- Lint, TypeScript, 16 unit tests and a production build with build-time secrets absent passed again. The newly added fault probe also passes lint and TypeScript.
- All **77 existing selected checks passed again**: 16 unit, 13 live workflow, nine boundary, 28 supplied-ledger audit and 11 release regression checks. Successful live NVIDIA/Nebius review and assistance were exercised. Counts describe the selected cases, not exhaustive coverage.
- The five fixed re-audit cases and one-cent rendering passed again: recipient verification, supported-period checks, empty income cleanup, partial payments and missing-section recovery, including CPR preservation and full payment completion.
- Runtime dependency audit/release check found no known runtime advisories. The full installation still has 13 development-tool entries: nine high and four moderate, as previously documented.
- The deployment gate still correctly reports the localhost URL and one owner's legacy demo password. Neither hosting nor human credentials were changed.
- Browser access remains disabled in Work settings. No new visual interaction is claimed. Current testing uses HTTP/API assertions and rendered page content.

The tests do not establish exhaustive security, legal tax accuracy, performance under sustained load or hosted reliability. The unchanged scope limits remain: supplied July 2024–June 2025 calculations, absent salary bands, unsupported tiered calculations, and deferred public demo/repository/video/submission steps. The contest's required runtime NVIDIA/Nebius use is demonstrated locally; publication requirements are not completed by passing local tests.

## Reproduction

Run the previously documented local regression suites against a non-production database. For the additional fault test:

```text
npx tsx tests/audit-failure-recovery.integration.ts
```

It requires `/tmp/taxtech-fresh-env.json` from the existing isolated-install setup and an instance of the current production bundle running against that exact database on localhost:3002. It refuses a database whose name does not match `install_[a-f0-9]+`. All company/user/vendor/ledger records it creates are synthetic. It uses a company-specific temporary PostgreSQL trigger to simulate the audit-write outage, with cleanup in `finally`; no fault is injected in the user's main database.

Private observations are stored in `/tmp/taxtech-audit-round3-faults.json`. A completed observational probe is not a passing product test: both findings report `safe:false` in the current app. The failure probe reproduced the financial issue twice; a final database check confirmed zero remaining fault triggers, and the isolated test server was stopped. Do not publish private fixture credentials or client ledger contents.
