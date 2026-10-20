# Nebius x NVIDIA Global AI Hackathon — submission preparation

## Track and project description

**Best Apps and Agents.** TaxTech helps accountants turn a general ledger into a reviewed withholding-tax draft. Rule-based suggestions handle known account mappings and vendor preferences. NVIDIA Nemotron on Nebius Token Factory reviews unclear descriptions, explains the proposed category and asks for missing information. The accountant chooses income and sales-tax treatment and records approval or exclusion before the deterministic engine can calculate a batch. A contextual assistant guides users through mapping, review, vendor verification and batch generation.

This is a specific workflow for accountants dealing with ambiguous ledger descriptions and repeated manual classification. Potential time savings and classification accuracy are hypotheses until measured; do not claim a percentage improvement without an evaluated dataset and observed timing.

## NVIDIA and Nebius usage

Both ledger classification and in-app assistance call the Token Factory inference API at runtime using an NVIDIA Nemotron model. The default model is `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`. Server implementation: `lib/ai/nebius.ts`, with feature endpoints under `app/api/ai`. The API key is not shipped to the browser. The rest of the Next.js app can run on a conventional web host with Neon PostgreSQL.

## Work added during the submission period

The ledger parser, rule engines, vendor management and compliance pages predate the contest. New work in this submission adds:

- Real NVIDIA/Nebius classification with structured validation and saved explanations/questions.
- A human review queue, notes, reviewer/time records, exclusions and optional approved vendor memory.
- Enforcement that every monthly ledger entry has a decision before calculation; locked approved periods and stale-draft checks.
- Contextual AI application guidance with allowlisted navigation and local help fallback.
- Company-access enforcement, atomic import receipts, database write leases and AI request quotas.
- Setup documentation, license, synthetic ledger and workflow validation.

Preserve actual commits and dates as evidence. The organizer determines whether these improvements qualify as significant.

## Video outline (target 2 minutes 40 seconds)

0:00–0:20: Introduce the accountant's problem and show a synthetic ledger.
0:20–0:45: Upload, map and preview the ledger.
0:45–1:30: Run live Nemotron review. Show an explanation, a missing-information question, a correction and a recorded human decision.
1:30–2:05: Finish reviews, generate the draft, show deterministic calculation and vendor-status checks.
2:05–2:30: Open Ask TaxTech on a relevant page, ask a workflow question and follow its navigation link.
2:30–2:40: Explain the model/provider, limitations and benefit being tested.

Record real application footage; do not use simulated results as live evidence. Use only assets/music you own or may publish.

## Feedback to prepare after testing

Record actual observations about Token Factory response quality, latency, structured-output support, onboarding, model selection, credit redemption and failure handling. Include concrete examples, their impact and a proposed improvement. No fabricated feedback or performance claims.

## External steps still required

- Register/join and finalize the Devpost form with track, description, developer feedback and prior-project changes.
- Confirm entrant eligibility, team representative (if any), ownership and third-party permissions.
- Publish a public repository with the MIT license detectable by GitHub/GitLab/Bitbucket. No repository URL is confirmed here.
- Deploy and test the hosted demo. Provide a dedicated judge account privately in testing instructions. Hosting URL and credentials are not provided by this document.
- Keep judge access free and available through December 15, 2026, according to the supplied rules; ensure sufficient provider credit.
- Upload a publicly visible English YouTube demo under three minutes and add its link. No video URL is confirmed here.
- Submit by the deadline in the current official rules. The supplied deadline is October 30, 2026, 10:00 AM Pacific.

Code preparation alone does not complete these external steps or guarantee eligibility or a prize.
