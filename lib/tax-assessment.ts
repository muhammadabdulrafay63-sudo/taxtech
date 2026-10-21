import { z } from "zod";
import { compareMoney, percentageTax, sumMoney } from "./money";
import {
  TAX_POLICY_VERSION,
  incomePolicies,
  salesPolicies,
  assertSalesPolicy,
} from "./ty2025";
const amount = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
export const taxAssessmentSchema = z.object({
  version: z.literal(TAX_POLICY_VERSION),
  eligibilityConfirmed: z.literal(true),
  incomeGross: amount.optional(),
  salesBase: amount.optional(),
  salesTax: amount.optional(),
});
export type TaxAssessment = z.infer<typeof taxAssessmentSchema>;
/** Explicit human evidence, never inferred from a ledger description or AI response. */
export function validateTaxAssessment(
  value: unknown,
  incomeKey: string | null,
  salesKey: string | null,
  date: string,
): TaxAssessment | null {
  if (!incomeKey && !salesKey) return null;
  if (date < "2024-07-01" || date > "2025-06-30")
    throw new Error(
      "Invoice assessments support July 2024 through June 2025 only.",
    );
  const parsed = taxAssessmentSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "Confirm invoice amounts, historical tax status and category eligibility before approving this treatment.",
    );
  const assessment = parsed.data;
  if (
    incomeKey &&
    (!incomePolicies[incomeKey] ||
      !assessment.incomeGross ||
      compareMoney(assessment.incomeGross, "0") <= 0)
  )
    throw new Error(
      "Choose a reviewed TY2025 income category and enter its positive gross payment amount (including sales tax where required).",
    );
  if (salesKey) {
    const policy = salesPolicies[salesKey];
    if (!policy) throw new Error("Choose a reviewed TY2025 sales-tax case.");
    assertSalesPolicy({ ruleKey: salesKey, ...policy }, date);
    if (
      !assessment.salesBase ||
      compareMoney(assessment.salesBase, "0") <= 0 ||
      !assessment.salesTax ||
      compareMoney(
        percentageTax(assessment.salesBase, policy.stRate),
        assessment.salesTax,
      ) !== 0
    )
      throw new Error(
        `The separately invoiced sales tax must equal ${policy.stRate}% of the entered tax-exclusive value for this case. Other invoice treatments need specialist review.`,
      );
  }
  if (
    incomeKey?.startsWith("153_") &&
    salesKey &&
    compareMoney(
      assessment.incomeGross!,
      sumMoney([assessment.salesBase!, assessment.salesTax!]),
    ) !== 0
  )
    throw new Error(
      "For a combined section 153 invoice, income-tax gross must equal the sales-tax base plus invoiced sales tax. Split blended or partial payments before review.",
    );
  return assessment;
}
