import { z } from "zod";
import { isValidISODate } from "./review-policy";
export const isoDate = z
  .string()
  .refine(isValidISODate, "Use a valid YYYY-MM-DD date.");
export const amount = z
  .number()
  .finite()
  .min(0)
  .max(999999999999.99)
  .multipleOf(0.01);
export const employeeInput = z
  .object({
    companyId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    cnic: z.string().max(30).nullable().optional(),
    designation: z.string().max(200).nullable().optional(),
    monthlyGross: amount.nullable().optional(),
    annualProjected: amount.nullable().optional(),
    taxYear: z.literal(2025).default(2025),
  })
  .refine(
    (v) => v.monthlyGross != null || v.annualProjected != null,
    "Enter monthly gross or annual projected income.",
  );
