import configured from "../data/salary-schedule.json";
import { z } from "zod";
import { percentageTax, sumMoney, compareMoney } from "./money";
const schema = z.object({
  taxYear: z.literal(2025),
  source: z.string().trim().min(1),
  surcharge: z
    .object({
      threshold: z.number().finite().nonnegative(),
      rate: z.number().finite().min(0).max(100),
    })
    .optional(),
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
    const expectedBase = previous
      ? sumMoney([
          previous.baseTax.toFixed(2),
          percentageTax(
            (b.lower - previous.lower).toFixed(2),
            previous.rate.toFixed(3),
          ),
        ])
      : "0";
    if (compareMoney(b.baseTax.toFixed(2), expectedBase) !== 0)
      throw new Error("Salary base tax must agree with the preceding bands.");
  }
  if (schedule.bands.at(-1)?.upper !== null)
    throw new Error("Salary bands must include an open-ended final band.");
  const band = schedule.bands.find(
    (b) =>
      annualTaxableIncome >= b.lower &&
      (b.upper === null || annualTaxableIncome <= b.upper),
  )!;
  const baseTax = Number(
    sumMoney([
      band.baseTax.toFixed(2),
      percentageTax(
        (annualTaxableIncome - band.lower).toFixed(2),
        band.rate.toFixed(3),
      ),
    ]),
  );
  const surcharge =
    schedule.surcharge && annualTaxableIncome > schedule.surcharge.threshold
      ? Number(
          percentageTax(baseTax.toFixed(2), schedule.surcharge.rate.toFixed(3)),
        )
      : 0;
  const annualTax = Number(
    sumMoney([baseTax.toFixed(2), surcharge.toFixed(2)]),
  );
  return {
    baseTax,
    surcharge,
    annualTax,
    monthlyTax: Math.round((annualTax / 12) * 100) / 100,
    effectiveRate: annualTaxableIncome
      ? Math.round((annualTax / annualTaxableIncome) * 10000) / 100
      : 0,
    slabApplied: `${band.lower} – ${band.upper ?? "above"} @ ${band.rate}%`,
  };
}
export const salaryScheduleAvailable = schema.safeParse(configured).success;
export const MAX_SALARY_ESTIMATE = 150000000;
export function calcAnnualSalaryWHT(annualTaxableIncome: number) {
  if (!salaryScheduleAvailable)
    throw new Error("A verified numeric salary schedule is required.");
  if (annualTaxableIncome > MAX_SALARY_ESTIMATE)
    throw new Error(
      "Income above PKR 150 million requires a separate super-tax assessment.",
    );
  return calcSalaryWithSchedule(annualTaxableIncome, configured);
}
