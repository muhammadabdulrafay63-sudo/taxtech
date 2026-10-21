# TaxTech - technical submission copy

Prepared for the owner to review and paste into Devpost. This file does not submit the entry or make entrant/ownership declarations on the owner's behalf.

## Project title

TaxTech

## Short description

An accountant's copilot that turns unclear ledger descriptions into human-reviewed withholding-tax drafts, using NVIDIA Nemotron on Nebius Token Factory.

## Track

Best Apps and Agents

## Links

- Working app: https://taxtech-zeta.vercel.app
- Public repository: https://github.com/muhammadabdulrafay63-sudo/taxtech
- Judge instructions: https://github.com/muhammadabdulrafay63-sudo/taxtech/blob/main/docs/judge-testing.md
- YouTube demo: add the owner's publicly visible video after recording.
- Judge credentials: copy from the private local access note into the appropriate testing field after checking its visibility. Do not put the owner password or provider keys in the submission.

## What it does

Accountants often receive general ledgers with descriptions that do not identify the correct withholding treatment. TaxTech imports Excel/CSV files, suggests known mappings and uses NVIDIA Nemotron to review unclear descriptions. The model proposes a category, explains its reasoning and asks for missing information. A person checks the invoice and vendor evidence, records a decision and supplies the correct gross-payment and sales-tax bases. The deterministic engine then generates a draft batch and internal PDF summary.

A contextual assistant helps users navigate mapping, review and batch generation. It offers guidance and allowlisted links; it does not execute financial actions. The judge workspace provides an approved example, supporting synthetic invoice facts and a resettable practice ledger.

## How we built it and use the required technology

The app uses Next.js/React, Neon PostgreSQL and Drizzle, and is hosted on Vercel. Both ledger review and contextual assistance make real server-side runtime inference calls to Nebius Token Factory using `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`. The application uses Token Factory; it does not claim to run on Nebius AI Cloud compute or use Tavily.

The backend validates structured model responses against allowed entries and rule keys. Model advice never becomes an approval. Tax arithmetic uses reviewed configuration and exact decimal operations, with recorded input snapshots, tenant checks, write leases and stale-draft/approved-period protection. Provider keys stay server-side. Scheduled health checks and encrypted off-site backups support operation.

## What was significantly improved during the submission period

TaxTech began as an existing ledger/compliance application; the prior baseline is visible in the March 2026 history. During the contest period we added runtime NVIDIA/Nebius classification, saved explanations and missing-information questions, a recorded human-review workflow, contextual app assistance, a first-run tour, stronger access and transaction protections, deployment operations, reviewed TY2025 invoice-based cases, and the dedicated synthetic judge experience.

Relevant history (these links show the changes, not a claim that the organizer has accepted their significance):

- APIs and review workflow: https://github.com/muhammadabdulrafay63-sudo/taxtech/commit/b46708c
- Workspace, assistant and tour: https://github.com/muhammadabdulrafay63-sudo/taxtech/commit/5e0422e
- Verification tooling: https://github.com/muhammadabdulrafay63-sudo/taxtech/commit/04a7701
- Operations: https://github.com/muhammadabdulrafay63-sudo/taxtech/commit/4c938da
- TY2025 configuration and invoice assessment: https://github.com/muhammadabdulrafay63-sudo/taxtech/commit/b88a296
- Dedicated judge experience: https://github.com/muhammadabdulrafay63-sudo/taxtech/commit/3f0a8f3

## Nebius/NVIDIA feedback grounded in testing

Token Factory let us use the same NVIDIA model for classification and app guidance without operating a GPU service. In a hosted judge-setup test on October 21, 2026, both features returned responses accepted by the application's validation. The classification API request took 4.992 seconds and the assistant request took 2.421 seconds end to end. These are two individual application round trips, including network/database/application work; they are not a latency benchmark or model-server measurement.

We still need application-side validation and a human decision when invoice descriptions are ambiguous. A clearly documented machine-readable credit-balance and expiry interface would help us monitor inference availability throughout judging. We used Token Factory and Nemotron; AI Cloud compute was not used, so we do not claim experience with it. The owner should add any personal onboarding/credit-redemption feedback they actually experienced.

## Validation and limitations

The hosted workflow has been tested with synthetic data: login, upload/duplicate rejection, live model review and assistance, a separate reviewer-approval workflow, invoice validation, calculation/approval, internal PDF generation, isolation and write restrictions. The TY2025 regression checks eight sales-tax cases across all five supported authorities. The synthetic judge account's owner isolation and global-admin rejection were tested.

The release covers specific historical TY2025 cases, not every tax situation or current-year law. Annual individual/AOP rent, non-resident/treaty and other unmodeled cases remain blocked for specialist treatment. Salary figures are estimates rather than payroll true-ups. The app does not query live ATL registries, file returns or make payments. We have not measured an accuracy score or percentage time saving and do not claim either. All judge sample data and tax-status assumptions are invented.

## Built with

TypeScript, Next.js, React, NextAuth, Drizzle ORM, PostgreSQL, Neon, Nebius Token Factory, NVIDIA Nemotron, Vercel.

## Inspiration

A ledger description often leaves out the facts an accountant needs to decide withholding treatment. We wanted a review workflow that makes those missing facts visible and keeps the accountant responsible for the final decision.

## Challenges

The main challenge was separating useful model interpretation from financial authority. We needed strict response validation, separate human approval, explicit invoice bases and safeguards against approving a draft after its inputs changed. Source workbooks also contained historical rate mismatches, so we reconciled the enabled TY2025 cases and blocked treatments the engine could not safely support.

## Accomplishments

The hosted app completes the path from synthetic upload to live AI review, human decisions, deterministic batches and internal PDF output. The dedicated judge account can inspect a completed example and repeat the practice without accessing owner data. The technical tests also cover duplicate imports, tenant boundaries, approved-period locks and failure handling.

## What we learned

A plausible ledger label is not enough to determine tax. Recipient type, invoice composition, historical status, jurisdiction and special-case eligibility must be explicit. Keeping model suggestions separate from approval and arithmetic made these uncertainties visible rather than burying them in an automated answer.

## What's next (proposed; owner may edit)

Extend reviewed policy coverage with specialist input, evaluate classification on a labeled synthetic dataset, and measure the complete accountant workflow before making time-saving or accuracy claims. Continue improving the availability and observability of the judge/demo experience.
