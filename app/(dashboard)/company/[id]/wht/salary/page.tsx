import { requireCompany } from "@/lib/page-access";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { salaryScheduleAvailable, calcAnnualSalaryWHT } from "@/lib/salaryWHT";
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
          Number(e.annualProjected ?? e.monthlyGross ?? 0) >= 0,
      )
      .map((e) => [
        e.id,
        calcAnnualSalaryWHT(
          e.annualProjected != null
            ? Number(e.annualProjected)
            : Number(e.monthlyGross ?? 0) * 12,
        ),
      ]),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Salary records — Section 149
          </h1>
          <p className="text-sm text-muted-foreground">
            Tax Year 2025 reference basis
          </p>
        </div>
        <AddEmployeeForm companyId={id} />
      </div>
      {!salaryScheduleAvailable && (
        <p
          role="status"
          className="rounded-lg border bg-background p-4 text-sm"
        >
          Your supplied income-tax workbook refers to slab rates but contains no
          numeric salary bands. Employee records can be saved; salary
          withholding totals remain unavailable until a verified numeric
          schedule is supplied. Unverified legacy calculations are not used.
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
              <th className="p-3">Withholding</th>
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
                      ? "Unsupported year or inactive"
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
