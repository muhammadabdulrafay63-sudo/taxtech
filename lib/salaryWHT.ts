import configured from "../data/salary-schedule.json";
import { z } from "zod";
import { percentageTax, sumMoney } from "./money";
const schema = z.object({
  taxYear: z.literal(2025),
  source: z.string().trim().min(1),
  bands: z
    .array(
      z.object({
        lower: z.number().finite().min(0),
        upper: z.number().finite().nonnegative().nullable(),
        rate: z.number().finite().min(0).max(100),
        baseTax: z.number().finite().min(0),
      }),
    )
    .min(1),
});
export function calcSalaryWithSchedule(
  annualTaxableIncome: number,
  input: unknown,
) {
  if (
    !Number.isFinite(annualTaxableIncome) ||
    annualTaxableIncome < 0 ||
    annualTaxableIncome > 999999999999.99
  )
    throw new Error("Salary income must be a finite nonnegative amount.");
  const schedule = schema.parse(input);
  for (let i = 0; i < schedule.bands.length; i++) {
    const b = schedule.bands[i];
    const previous = schedule.bands[i - 1];
    if (
      b.lower !== (previous?.upper ?? 0) ||
      (b.upper !== null && b.upper <= b.lower) ||
      (b.upper === null && i !== schedule.bands.length - 1)
    )
      throw new Error(
        "Salary bands must be contiguous, ordered and non-overlapping.",
      );
  }
  if (schedule.bands.at(-1)?.upper !== null)
    throw new Error("Salary bands must include an open-ended final band.");
  const band = schedule.bands.find(
    (b) =>
      annualTaxableIncome >= b.lower &&
      (b.upper === null || annualTaxableIncome <= b.upper),
  )!;
  const annualTax = Number(
    sumMoney([
      band.baseTax.toFixed(2),
      percentageTax(
        (annualTaxableIncome - band.lower).toFixed(2),
        band.rate.toFixed(3),
      ),
    ]),
  );
  return {
    annualTax,
    monthlyTax: Math.round((annualTax / 12) * 100) / 100,
    effectiveRate: annualTaxableIncome
      ? Math.round((annualTax / annualTaxableIncome) * 10000) / 100
      : 0,
    slabApplied: `${band.lower} – ${band.upper ?? "above"} @ ${band.rate}%`,
  };
}
export const salaryScheduleAvailable = schema.safeParse(configured).success;
export function calcAnnualSalaryWHT(annualTaxableIncome: number) {
  if (!salaryScheduleAvailable)
    throw new Error(
      "The supplied references do not contain numeric salary slabs. Add a verified source schedule before calculating salary withholding.",
    );
  return calcSalaryWithSchedule(annualTaxableIncome, configured);
}
