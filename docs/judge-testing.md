# TaxTech - judge testing instructions

Live application: https://taxtech-zeta.vercel.app

Dedicated judge credentials are supplied in the organizer-designated testing instructions, not in this repository. They belong only to a synthetic demo company. No provider accounts, payment or invitation from the owner are required. After signing in, open **Judge testing guide** in the synthetic-workspace banner. Finish or skip the first-run tour; it can be replayed from the top bar.

## Completed example: March 2025

Inspect the prepared, approved income batch and internal PDF summary. The income batch is PKR 16,250 on PKR 233,000 gross payments. Separate sales-tax batches contain PKR 3,600 for FBR and PKR 3,000 for SRB. The saved AI suggestions came from an actual NVIDIA Nemotron call to Nebius Token Factory; the recorded reviewer approvals were applied separately from the model suggestions using the invented invoice facts.

Every vendor, status and invoice is invented. The status timestamps are synthetic evidence for the demonstration, not actual historical ATL verification. No real taxpayer records, filings, payments or official FBR payment slips are involved.

## Hands-on practice: April 2025

1. Open the April practice link. Three entries start pending.
2. Choose **Review unclear entries with AI**. Inspect the explanation and missing-information questions. AI cannot approve, file or pay anything.
3. Resolve the two supplier entries using the invoice facts below. Choose both income and sales-tax treatment, enter the separate bases, confirm eligibility, and write a note identifying these synthetic facts.
4. Exclude the internal transfer with a reason. Generate an income draft; expected tax is PKR 16,250. Inspect the lines, then approve if desired. Generate and inspect the FBR/SRB sales-tax batches separately.
5. Open **Ask TaxTech** and ask how to finish reviewing an unclear invoice. Follow its relevant navigation link.
6. To repeat, return to the judge guide, acknowledge the confirmation and select **Reset April practice**. This replaces all April demo entries/results, including any April uploads or mock payments, with three pending entries. March, other months and other companies are preserved. Custom uploaded-file duplicate receipts are retained. Do not reset while another judge is actively working in the shared account.

### Invented supporting invoice facts

| Entry             | Income treatment                                           |   Gross including ST | Sales-tax case                                                                                             | Value excluding ST |    Invoiced ST |
| ----------------- | ---------------------------------------------------------- | -------------------: | ---------------------------------------------------------------------------------------------------------- | -----------------: | -------------: |
| Demo Stationery   | Ordinary goods, resident company, 5% ATL rate              |              118,000 | FBR ordinary 18% goods, active supplier to eligible company buyer **not** ST-registered; 1/5 of invoice ST |            100,000 |         18,000 |
| Demo Assurance    | Other services, resident company, 9% ATL rate              |              115,000 | SRB ordinary private-company-agent case, 15% standard rate; 1/5 of invoice ST                              |            100,000 |         15,000 |
| Own-bank transfer | Excluded, internal movement rather than a supplier payment | 25,000 ledger amount | Not applicable                                                                                             |     Not applicable | Not applicable |

The professional engagement is a **statutory audit fee**, not IT, transport, software, training or another specified 4% service. Assume both suppliers are resident companies with the relevant historical registered/active status, no exemption, and no special/reduced-rate treatment. Annual thresholds, prescribed-payer/withholding-agent status and jurisdiction are met in this invented example. Do not infer these facts for a real vendor.

## Optional upload test: May 2025

Download `public/judge-demo-ledger.csv` from the in-app guide and upload it. Map Date, Description, Account Code, Debit, Credit and Reference to the matching columns. The three May rows keep this test separate from the completed and resettable periods. Re-importing the same sheet with the same mappings intentionally returns a duplicate warning; open the existing May entries instead.

## Scope and access

The app supports specific reviewed TY2025 cases (July 2024-June 2025). Unsupported taxable cases must remain pending for specialist treatment. Salary values are separate estimates, not payroll true-ups. See `ty2025-configuration.md` for limits.

The account has the accountant role in its own company, not global administration. Please use invented data only and keep the shared login/company profile unchanged. Core tests are free; application request limits still protect provider usage. If AI temporarily returns a quota message, wait as instructed and notify the submitter if it persists. The prepared example and manual review remain available.

Owner operations: keep the account, app, database and inference access usable through December 15, 2026, noon Pacific Standard Time (December 16, 1 AM Pakistan). Health monitoring checks the dedicated identity/credential fingerprint and prepared example. Credit balance and expiry need a separate provider-billing check; a successful inference today does not guarantee credits through judging.
