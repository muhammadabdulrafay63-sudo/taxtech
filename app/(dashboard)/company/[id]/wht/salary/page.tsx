import { requireCompany } from "@/lib/page-access";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  salaryScheduleAvailable,
  calcAnnualSalaryWHT,
  MAX_SALARY_ESTIMATE,
} from "@/lib/salaryWHT";
import { AddEmployeeForm } from "./AddEmployeeForm";
export default async function SalaryWHTPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCompany(id);
  const rows = await db
    .select()
    .from(employees)
    .where(eq(employees.companyId, id))
    .orderBy(employees.name);
  const calculations = new Map(
    rows
      .filter(
        (e) =>
          salaryScheduleAvailable &&
          e.taxYear === 2025 &&
          e.isActive &&
          e.annualProjected !== null &&
          Number(e.annualProjected) >= 0 &&
          Number(e.annualProjected) <= MAX_SALARY_ESTIMATE,
      )
      .map((e) => [e.id, calcAnnualSalaryWHT(Number(e.annualProjected))]),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Salary estimates - Tax Year 2025
          </h1>
          <p className="text-sm text-muted-foreground">
            Verified TY2025 salary bands, including the 10% tax surcharge above
            PKR 10 million.
          </p>
        </div>
        <AddEmployeeForm companyId={id} />
      </div>
      <p className="rounded-lg border bg-background p-4 text-sm">
        These are estimates for salary-only taxable income. Enter projected
        taxable salary after checking taxable benefits and exemptions. Monthly
        estimates divide annual tax by 12; actual payroll needs adjustment for
        tax already deducted, remaining pay periods, tax credits and other
        income. Income above PKR 150 million needs a separate super-tax
        assessment. Salary entries are not part of the vendor withholding batch.
      </p>
      {!salaryScheduleAvailable && (
        <p
          role="status"
          className="rounded-lg border bg-background p-4 text-sm"
        >
          The source schedule failed validation. Estimates are unavailable until
          the verified TY2025 salary schedule is restored.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-right">Monthly gross</th>
              <th className="p-3 text-right">Projected annual</th>
              <th className="p-3">Tax year</th>
              <th className="p-3">Status</th>
              <th className="p-3">Monthly estimate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="p-3">{e.name}</td>
                <td className="p-3 text-right">
                  {e.monthlyGross != null
                    ? `PKR ${Number(e.monthlyGross).toLocaleString("en-PK")}`
                    : "Not supplied"}
                </td>
                <td className="p-3 text-right">
                  {e.annualProjected != null
                    ? `PKR ${Number(e.annualProjected).toLocaleString("en-PK")}`
                    : "Not supplied"}
                </td>
                <td className="p-3">{e.taxYear}</td>
                <td className="p-3">{e.isActive ? "Active" : "Inactive"}</td>
                <td className="p-3">
                  {calculations.has(e.id)
                    ? `PKR ${calculations.get(e.id)!.monthlyTax.toFixed(2)} / month`
                    : salaryScheduleAvailable
                      ? "Missing input, inactive, unsupported year or specialist assessment required"
                      : "Source schedule required"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No employee records yet.
          </p>
        )}
      </div>
    </div>
  );
}
