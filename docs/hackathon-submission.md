# Nebius x NVIDIA Global AI Hackathon — submission preparation

> Product: **TaxTech — AI-Assisted Withholding Tax Preparation**. The demo uses FY2024–25 (Tax Year 2025). Tax constants can be modified for any tax year together with its applicable rules and effective dates, followed by validation before activation. See [tax-year configuration](tax-year-configuration.md) for the required changes and current limits.

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

0:00–0:20: Introduce TaxTech — AI-Assisted Withholding Tax Preparation. Explain the withholding problem and show a synthetic ledger.
0:20–0:45: Upload, map and preview the ledger.
0:45–1:30: Run live Nemotron review. Show an explanation, a missing-information question, a correction and a recorded human decision.
1:30–2:05: Finish reviews, generate the draft, show deterministic calculation and vendor-status checks.
2:05–2:30: Open Ask TaxTech on a relevant page, ask a workflow question and follow its navigation link.
2:30–2:40: Explain the model/provider and human approval. State: this demo uses FY2024–25; tax constants can be modified for any tax year together with its rules and effective dates, then validated before activation.

Record real application footage; do not use simulated results as live evidence. Use only assets/music you own or may publish.

## Feedback to prepare after testing

Record actual observations about Token Factory response quality, latency, structured-output support, onboarding, model selection, credit redemption and failure handling. Include concrete examples, their impact and a proposed improvement. No fabricated feedback or performance claims.

## Developer package and remaining owner steps

The live app is published at https://taxtech-zeta.vercel.app and the public MIT repository is https://github.com/muhammadabdulrafay63-sudo/taxtech. A dedicated accountant account and synthetic company now provide a completed March 2025 example and April practice. Credentials remain in a private local note and are excluded from Git. See [judge testing instructions](judge-testing.md) and [technical Devpost copy](devpost-submission-copy.md).

A public English YouTube demo and a 4/5-step Devpost draft were prepared on 28 October 2026. The video now needs recreation with the revised withholding narrative and tax-year explanation; the owner requested that recreation as a separate next step. Update its link in Devpost after replacement. The owner retains final review, terms acceptance and submission. Local copy revisions are not proof that the hosted app, public repository or saved Devpost story has been updated. Provider credit balance and expiry must be checked separately to cover judging. Current inference success is not proof of future credits. The remaining-actions PDF gives the concrete sequence.

Code preparation and a public deployment do not themselves complete a contest submission or guarantee eligibility or a prize.

## Submission preparation completed 29 October 2026

The revised public English demo is https://www.youtube.com/watch?v=vyyEi_GT1x8 (2:42). Devpost’s title, pitch, story, thumbnail and video link are saved with the withholding-preparation narrative and FY2024–25 configurability explanation. The private judge-access note remains attached. The entry is still DRAFT at 4/5 steps; terms acceptance and final submission remain the owner’s responsibility. Earlier video-recreation instructions above record the prior preparation stage. See [publication status](submission-final-review-2026-10-29.md).
