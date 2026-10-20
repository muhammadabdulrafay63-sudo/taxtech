import { formatPKR } from "@/lib/money";
import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { whtBatches } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, CheckCircle2, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { MonthlyBatchActions } from "./MonthlyBatchActions";

interface Props {
  params: Promise<{ id: string }>;
}

const MONTH_NAMES = [
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

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">No batch</Badge>;
  if (status === "draft")
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30">
        Draft
      </Badge>
    );
  if (status === "approved")
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30">
        Approved
      </Badge>
    );
  if (status === "paid")
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30">
        Paid
      </Badge>
    );
  return <Badge variant="secondary">{status}</Badge>;
}



export default async function WHTMonthlyPage({ params }: Props) {
  const [session, { id: companyId }] = await Promise.all([auth(), params]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  // Get distinct year+month — raw SQL avoids Drizzle selectDistinct+orderBy issue
  const txnMonthsResult = await db.execute<{ year: number; month: number }>(
    sql`SELECT DISTINCT
          EXTRACT(YEAR FROM txn_date::date)::int  AS year,
          EXTRACT(MONTH FROM txn_date::date)::int AS month
        FROM gl_transactions
        WHERE company_id = ${companyId}
        ORDER BY year, month`,
  );
  // Neon execute() returns { rows: [...] }
  const txnMonths: { year: number; month: number }[] = ((
    txnMonthsResult as unknown as { rows: { year: number; month: number }[] }
  ).rows ?? txnMonthsResult) as { year: number; month: number }[];

  // Get all existing batches for this company
  const batches = await db
    .select({
      id: whtBatches.id,
      year: whtBatches.year,
      month: whtBatches.month,
      status: whtBatches.status,
      totalWht: whtBatches.totalWht,
      totalGross: whtBatches.totalGross,
      approvedAt: whtBatches.approvedAt,
    })
    .from(whtBatches)
    .where(eq(whtBatches.companyId, companyId));

  const batchMap = new Map(batches.map((b) => [`${b.year}-${b.month}`, b]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Monthly WHT Batches</h1>
        <p className="text-sm text-muted-foreground">
          Calculate, review, and approve WHT for each month. WHT deposit is due
          by the 7th of the following month.
        </p>
      </div>

      {txnMonths.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Calculator className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No transactions yet</p>
              <p className="text-sm text-muted-foreground">
                Upload a GL file first to calculate WHT
              </p>
            </div>
            <Link
              href={`/company/${companyId}/upload`}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Upload GL
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Deadline reminder */}
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30 text-sm">
            <Clock className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <span className="text-blue-800 dark:text-blue-300">
              WHT deposit deadline: <strong>7th of the following month</strong>{" "}
              · Monthly WHT statement: <strong>15th of following month</strong>
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Gross Amount
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      WHT Payable
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {txnMonths.map(({ year, month }) => {
                    const key = `${year}-${month}`;
                    const batch = batchMap.get(key);
                    return (
                      <tr
                        key={key}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-medium">
                          {MONTH_NAMES[month - 1]} {year}
                        </td>
                        <td className="px-4 py-3">
                          {statusBadge(batch?.status ?? null)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatPKR(batch?.totalGross ?? null)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatPKR(batch?.totalWht ?? null)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {batch ? (
                              <>
                                <Link
                                  href={`/company/${companyId}/wht/batch/${batch.id}`}
                                  className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                                >
                                  <FileText className="h-3 w-3" />
                                  View batch
                                </Link>
                                {batch.status === "approved" && (
                                  <span className="flex items-center gap-1 text-xs text-green-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Approved
                                  </span>
                                )}
                              </>
                            ) : null}
                            <MonthlyBatchActions
                              companyId={companyId}
                              year={year}
                              month={month}
                              hasBatch={!!batch}
                              batchStatus={batch?.status ?? null}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
