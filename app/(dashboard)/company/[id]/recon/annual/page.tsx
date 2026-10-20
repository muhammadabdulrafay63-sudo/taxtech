import { requireCompany } from "@/lib/page-access";
import { sumMoney, subtractMoney, formatPKR, compareMoney } from "@/lib/money";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  whtLines,
  whtRules,
  vendors,
  whtBatches,
  whtBatchItems,
  challanRecords,
} from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BarChart3 } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}

export default async function AnnualReconPage({ params, searchParams }: Props) {
  const [session, { id: companyId }, sp] = await Promise.all([
    auth(),
    params,
    searchParams,
  ]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  const currentYear = new Date().getFullYear();
  const parsedYear = Number(sp.year ?? 2025);
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : 2025;

  // All WHT lines for the year
  const allLines = await db
    .select({
      batchStatus: whtBatches.status,
      vendorId: whtLines.vendorId,
      vendorName: vendors.name,
      ruleKey: whtRules.ruleKey,
      section: whtRules.section,
      grossAmount: whtLines.grossAmount,
      whtAmount: whtLines.whtAmount,
      taxStatus: whtLines.taxStatus,
      periodMonth: whtLines.periodMonth,
    })
    .from(whtLines)
    .innerJoin(whtBatchItems, eq(whtBatchItems.whtLineId, whtLines.id))
    .innerJoin(whtBatches, eq(whtBatchItems.batchId, whtBatches.id))
    .leftJoin(vendors, eq(whtLines.vendorId, vendors.id))
    .leftJoin(whtRules, eq(whtLines.ruleId, whtRules.id))
    .where(
      and(eq(whtLines.companyId, companyId), eq(whtLines.periodYear, year)),
    );

  // All batches for the year
  const batches = await db
    .select({
      id: whtBatches.id,
      month: whtBatches.month,
      status: whtBatches.status,
      totalWht: whtBatches.totalWht,
    })
    .from(whtBatches)
    .where(and(eq(whtBatches.companyId, companyId), eq(whtBatches.year, year)));

  const lines = allLines.filter((l) => l.batchStatus !== "draft");
  const draftTotal = sumMoney(
    allLines.filter((l) => l.batchStatus === "draft").map((l) => l.whtAmount),
  );
  const payments = await db
    .select({
      batchId: challanRecords.batchId,
      amount: challanRecords.totalWht,
    })
    .from(challanRecords)
    .innerJoin(whtBatches, eq(challanRecords.batchId, whtBatches.id))
    .where(
      and(
        eq(whtBatches.companyId, companyId),
        eq(whtBatches.year, year),
        isNotNull(challanRecords.cprNumber),
        isNotNull(challanRecords.paymentDate),
      ),
    );
  const partialPaid = new Set(
    batches
      .filter(
        (b) => b.status !== "paid" && payments.some((p) => p.batchId === b.id),
      )
      .map((b) => b.month),
  );

  // Aggregate per vendor
  type VendorRow = {
    vendorId: string | null;
    vendorName: string;
    totalGross: string;
    totalWht: string;
    sections: Set<string>;
    months: Set<number>;
  };
  const vendorMap = new Map<string, VendorRow>();

  for (const l of lines) {
    const key = l.vendorId ?? `no-vendor-${l.ruleKey}`;
    const existing = vendorMap.get(key);
    if (existing) {
      existing.totalGross = sumMoney([
        existing.totalGross,
        l.grossAmount ?? "0",
      ]);
      existing.totalWht = sumMoney([existing.totalWht, l.whtAmount ?? "0"]);
      if (l.section) existing.sections.add(l.section);
      if (l.periodMonth) existing.months.add(l.periodMonth);
    } else {
      vendorMap.set(key, {
        vendorId: l.vendorId,
        vendorName: l.vendorName ?? "(Unknown vendor)",
        totalGross: l.grossAmount ?? "0",
        totalWht: l.whtAmount ?? "0",
        sections: new Set(l.section ? [l.section] : []),
        months: new Set(l.periodMonth ? [l.periodMonth] : []),
      });
    }
  }

  const vendorRows = [...vendorMap.values()].sort((a, b) =>
    compareMoney(b.totalWht, a.totalWht),
  );

  // Summary
  const totalExpectedWHT = sumMoney(lines.map((l) => l.whtAmount));
  const totalPaidWHT = sumMoney(payments.map((p) => p.amount));
  const variance = subtractMoney(
    sumMoney(lines.map((l) => l.whtAmount)),
    sumMoney(payments.map((p) => p.amount)),
  );

  const approvedMonths = new Set(
    batches.filter((b) => b.status !== "draft").map((b) => b.month),
  );
  const missingMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(
    (m) => allLines.some((l) => l.periodMonth === m) && !approvedMonths.has(m),
  );

  const MONTH_SHORT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Year selector
  const availableYears = [
    ...new Set([2024, 2025, currentYear - 1, currentYear]),
  ].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Annual Reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Calendar-year summary of approved withholding and recorded payments;
            not a filed annual statement.
          </p>
        </div>
        <div className="flex gap-1">
          {availableYears.map((y) => (
            <a
              key={y}
              href={`?year=${y}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${y === year ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
            >
              {y}
            </a>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              Approved WHT Liability
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatPKR(totalExpectedWHT)}
            </p>
            <p className="text-xs text-muted-foreground">
              {lines.length} transactions · {vendorRows.length} vendors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total WHT Paid</p>
            <p
              className={`mt-1 text-2xl font-bold ${compareMoney(totalPaidWHT, "0") > 0 ? "text-green-600" : "text-muted-foreground"}`}
            >
              {formatPKR(totalPaidWHT)}
            </p>
            <p className="text-xs text-muted-foreground">
              {payments.length} recorded payments · {partialPaid.size} partially
              paid batches
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Variance</p>
            <p
              className={`mt-1 text-2xl font-bold ${variance === "0.00" ? "text-green-600" : "text-red-600"}`}
            >
              {variance === "0.00"
                ? "Nil"
                : formatPKR(variance.replace(/^-/, ""))}
            </p>
            <p className="text-xs text-muted-foreground">
              {variance === "0.00"
                ? "Fully reconciled ✓"
                : compareMoney(variance, "0") > 0
                  ? "Under-paid"
                  : "Over-paid"}
            </p>
          </CardContent>
        </Card>
      </div>

      {compareMoney(draftTotal, "0") > 0 && (
        <p className="text-sm text-amber-700">
          Draft estimates: {formatPKR(draftTotal)}. Excluded from approved
          liability and payment variance.
        </p>
      )}

      {/* Missing months */}
      {missingMonths.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800 dark:text-red-300">
            <span className="font-semibold">Missing approved batches</span> for
            months with transactions:{" "}
            {missingMonths.map((m) => MONTH_SHORT[m - 1]).join(", ")}
          </p>
        </div>
      )}

      {/* Batch status grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Monthly Batch Status — {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {MONTH_SHORT.map((m, i) => {
              const batch = batches.find((b) => b.month === i + 1);
              const hasTxns = allLines.some((l) => l.periodMonth === i + 1);
              if (!hasTxns)
                return (
                  <div
                    key={m}
                    className="rounded border px-2 py-1 text-xs text-muted-foreground/40"
                  >
                    {m}
                  </div>
                );
              return (
                <div
                  key={m}
                  className={`rounded border px-2 py-1 text-xs font-medium ${
                    batch?.status === "paid"
                      ? "border-green-300 bg-green-50 text-green-700"
                      : batch?.status === "approved"
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : batch?.status === "draft"
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-red-300 bg-red-50 text-red-700"
                  }`}
                >
                  {m}{" "}
                  {partialPaid.has(i + 1)
                    ? "partially paid"
                    : batch
                      ? batch.status
                      : "missing"}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vendor breakdown */}
      {vendorRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No WHT calculated for {year} yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Per-Vendor WHT Summary — {year}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Vendor
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Sections
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Months
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                    Gross Paid
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                    WHT Deducted
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendorRows.map((v, i) => (
                  <tr
                    key={i}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2 font-medium">{v.vendorName}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {[...v.sections].map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className="text-[10px]"
                          >
                            Sec {s}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {[...v.months]
                        .sort((a, b) => a - b)
                        .map((m) => MONTH_SHORT[m - 1])
                        .join(", ")}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {formatPKR(v.totalGross)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {formatPKR(v.totalWht)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={3} className="px-4 py-2 font-semibold">
                    Total
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {formatPKR(sumMoney(vendorRows.map((v) => v.totalGross)))}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-primary">
                    {formatPKR(totalExpectedWHT)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
