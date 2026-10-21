/** Reviewed TY2025 cases. The original workbook snapshot is provenance, not policy. */
export const TAX_POLICY_VERSION = "TY2025-2026-10-21.1";
export type IncomePolicy = {
  section: string;
  description: string;
  recipientType: string;
  rateFiler: string;
  rateNonFiler: string;
  keywords: string[];
  notes: string;
};
const income = (
  section: string,
  description: string,
  recipientType: string,
  filer: string,
  nonFiler: string,
  keywords: string[],
  notes: string,
): IncomePolicy => ({
  section,
  description,
  recipientType,
  rateFiler: filer,
  rateNonFiler: nonFiler,
  keywords,
  notes,
});
const section153 =
  "ITO 2001, amended 30 June 2024, section 153 and First Schedule Part III Division III; Tenth Schedule rule 1. Gross payment includes sales tax. Reviewer must check prescribed-payer status, annual aggregate threshold and exclusions before selecting. No automatic per-invoice exemption.";
export const incomePolicies: Record<string, IncomePolicy> = {
  "153_goods_company": income(
    "153",
    "Ordinary goods - resident company (excluding special goods and toll manufacturing)",
    "company",
    "5",
    "10",
    ["goods", "purchase", "material", "equipment"],
    section153,
  ),
  "153_goods_individual": income(
    "153",
    "Ordinary goods - resident individual/AOP (excluding special goods and toll manufacturing)",
    "individual_aop",
    "5.5",
    "11",
    ["goods", "purchase"],
    section153,
  ),
  "153_goods_rice_oils": income(
    "153",
    "Rice, cotton-seed oil or edible oils - resident recipient",
    "all",
    "1.5",
    "3",
    ["rice", "cotton seed oil", "edible oil"],
    section153,
  ),
  "153_toll_company": income(
    "153",
    "Toll manufacturing - resident company",
    "company",
    "9",
    "18",
    ["toll manufacturing"],
    section153,
  ),
  "153_toll_individual": income(
    "153",
    "Toll manufacturing - resident individual/AOP",
    "individual_aop",
    "11",
    "22",
    ["toll manufacturing"],
    section153,
  ),
  "153_services_company": income(
    "153",
    "Other services - resident company (not specified 4% services or media advertising)",
    "company",
    "9",
    "18",
    ["audit", "legal", "accountant", "consulting", "advisory"],
    section153,
  ),
  "153_services_individual": income(
    "153",
    "Other services - resident individual/AOP (not specified 4% services or media advertising)",
    "individual_aop",
    "11",
    "22",
    ["audit", "legal", "consulting", "professional fee"],
    section153,
  ),
  "153_services_transport": income(
    "153",
    "Transport services - resident recipient; specified-services conditions apply",
    "all",
    "4",
    "8",
    ["transport", "cargo", "haulage", "trucking"],
    section153 +
      " Division III(2)(i), including its gross-receipts/no-litigation condition.",
  ),
  "153_services_specified": income(
    "153",
    "Statutorily specified services - resident recipient (4% category)",
    "all",
    "4",
    "8",
    [
      "software development",
      "IT services",
      "freight forwarding",
      "courier",
      "security guard",
      "building maintenance",
      "testing",
      "training",
    ],
    section153 +
      " Only the services enumerated in Division III(2)(i); its gross-receipts/no-litigation condition must be satisfied. This is not a general reduced rate for all services.",
  ),
  "153_contract_company": income(
    "153",
    "Execution of contract - resident company (not sportsperson)",
    "company",
    "7.5",
    "15",
    ["contract", "construction", "civil work"],
    section153,
  ),
  "153_contract_individual": income(
    "153",
    "Execution of contract - resident individual/AOP (not sportsperson)",
    "individual_aop",
    "8",
    "16",
    ["contract", "contractor"],
    section153,
  ),
  "153_media_advertising": income(
    "153",
    "Advertising paid to electronic/print media (not general digital advertising)",
    "all",
    "1.5",
    "3",
    ["newspaper", "print media", "electronic media"],
    section153,
  ),
  // Legacy key retained so references are not orphaned; the recipient, not payer, determines the rate.
  "155_rent_company_payer": income(
    "155",
    "Rent of immovable property - resident COMPANY landlord",
    "company",
    "15",
    "30",
    ["rent", "lease", "office rent"],
    "ITO First Schedule Part III Division V(b), Tenth Schedule rule 1. Company RECIPIENT only. Individual/AOP landlords require annual cumulative slabs and are not handled by this flat-rate case.",
  ),
  "156_prize_bond": income(
    "156",
    "Prize on prize bond / crossword puzzle",
    "all",
    "15",
    "30",
    ["prize bond", "crossword"],
    "ITO First Schedule Part III Division VI(1), Tenth Schedule rule 1. Check payer and prize classification.",
  ),
  "156_lottery": income(
    "156",
    "Raffle, lottery, quiz or company sales-promotion prize",
    "all",
    "20",
    "40",
    ["lottery", "raffle", "quiz"],
    "ITO First Schedule Part III Division VI(2), Tenth Schedule rule 1. Check payer and prize classification.",
  ),
  "156a_petroleum": income(
    "156A",
    "Petroleum-agent/distributor commission or discount",
    "all",
    "12",
    "24",
    ["petroleum commission"],
    "ITO section 156A and First Schedule Part III Division VIA; Tenth Schedule rule 1. Applies to commission/discount, NOT the gross purchase price of fuel.",
  ),
};
export type SalesPolicy = {
  authority: string;
  province: string;
  description: string;
  stRate: string;
  whtFactor: string;
  validFrom: string;
  notes: string;
};
const sales = (
  authority: string,
  province: string,
  description: string,
  stRate: string,
  whtFactor: string,
  notes: string,
  validFrom = "2024-07-01",
): SalesPolicy => ({
  authority,
  province,
  description,
  stRate,
  whtFactor,
  notes,
  validFrom,
});
export const salesPolicies: Record<string, SalesPolicy> = {
  ty25_fbr_active_unregistered_buyer: sales(
    "FBR",
    "National",
    "FBR: ordinary 18% goods; active supplier; company buyer NOT ST-registered",
    "18",
    "0.2",
    "Sales Tax Act 1990 (30 June 2024), Eleventh Schedule table 1 and exclusions. Supplier is not wholesaler/dealer/distributor. Buyer is a withholding company. No excluded goods, exemption, reduced/special regime or Third Schedule goods. Invoice separately states 18% ST.",
  ),
  ty25_fbr_active_registered_buyer: sales(
    "FBR",
    "National",
    "FBR: ordinary 18% goods; active supplier to registered buyer - no WHT",
    "18",
    "0",
    "Eleventh Schedule exclusion (viii). No exception in serials 5, 7, 9-13, or other special regime. Invoice separately states 18% ST. Confirm both parties' historical registration/active status.",
  ),
  ty25_srb_standard: sales(
    "SRB",
    "Sindh",
    "SRB: ordinary 15% invoice; active provider; private company agent - 1/5",
    "15",
    "0.2",
    "SRB withholding rules 2014, rule 3(3). Only ordinary standard-rate service, separately invoiced ST; no excluded sector, special recipient, non-filer, advertisement, rent, auction, transport or special/reduced-rate treatment. Check withholding-agent status and place of supply.",
  ),
  ty25_srb_public: sales(
    "SRB",
    "Sindh",
    "SRB: ordinary 15% invoice; public agent under rule 1(2)(a)/(b) - 4/5",
    "15",
    "0.8",
    "SRB rule 3(4A), as amended effective 1 July 2024. Registered active provider; no overriding full-withholding, exclusion or special-rate case. Check exact recipient classification.",
  ),
  ty25_pra_registered_noncompany: sales(
    "PRA",
    "Punjab",
    "PRA: ordinary 16% invoice; registered non-company provider - full tax",
    "16",
    "1",
    "PRA withholding rules 2015, rules 3 and 5 (before rule 5A added 10 July 2025). Not telecom, banking, courier, insurance, advertisement or any excluded/special/reduced-rate case. Agent and place of supply verified.",
  ),
  ty25_pra_active_company: sales(
    "PRA",
    "Punjab",
    "PRA: ordinary 16% invoice; active company provider - excluded from WHT",
    "16",
    "0",
    "PRA rule 3(1), before July 2025 amendment. Not advertisement or an overriding special case. Confirm provider is a company on PRA ATL for the payment date.",
  ),
  ty25_kpra_standard: sales(
    "KPRA",
    "KPK",
    "KPRA: ordinary 15% invoice; active provider; private agent - half tax (Jan-Jun 2025)",
    "15",
    "0.5",
    "KPRA withholding regulation 2024 paragraphs 4-6. Excludes all paragraph 4 exclusions and paragraph 5 full-withholding/reduced-rate cases. Conservative start is gazette publication; earlier dates require prior-regulation review.",
    "2025-01-03",
  ),
  ty25_bra_standard: sales(
    "BRA",
    "Balochistan",
    "BRA: ordinary 15% invoice; registered filer; ordinary agent - 1/5",
    "15",
    "0.2",
    "BRA withholding rules 2018 rule 3(3). No excluded sector, non-filer, advertisement, rent, auction, transport, special recipient or reduced/special-rate case. Invoice separately states ST; historical registration/filer and agent status checked.",
  ),
};
export function assertIncomePolicy(rule: {
  ruleKey: string;
  rateFiler: string;
  rateNonFiler: string;
  recipientType: string;
  thresholdAmount?: string | null;
  isTiered?: boolean;
  usesSlabRates?: boolean;
}) {
  const policy = incomePolicies[rule.ruleKey];
  if (!policy)
    throw new Error(
      "This income category is outside the reviewed TY2025 calculation cases. Obtain specialist treatment rather than use a generic rate.",
    );
  if (
    Number(rule.rateFiler) !== Number(policy.rateFiler) ||
    Number(rule.rateNonFiler) !== Number(policy.rateNonFiler) ||
    rule.recipientType !== policy.recipientType ||
    Number(rule.thresholdAmount ?? 0) !== 0 ||
    rule.isTiered ||
    rule.usesSlabRates
  )
    throw new Error(
      "Stored income rules do not match the reviewed TY2025 configuration. Apply the TY2025 configuration migration before calculating.",
    );
  return policy;
}
export function assertSalesPolicy(
  rule: {
    ruleKey: string;
    stRate: string;
    whtFactor: string;
    authority: string;
  },
  date: string,
) {
  const policy = salesPolicies[rule.ruleKey];
  if (
    !policy ||
    date < policy.validFrom ||
    date > "2025-06-30" ||
    Number(rule.stRate) !== Number(policy.stRate) ||
    Number(rule.whtFactor) !== Number(policy.whtFactor) ||
    rule.authority !== policy.authority
  )
    throw new Error(
      "This sales-tax case or date is not supported by the reviewed TY2025 configuration. Review the invoice and applicable historical rule.",
    );
  return policy;
}
