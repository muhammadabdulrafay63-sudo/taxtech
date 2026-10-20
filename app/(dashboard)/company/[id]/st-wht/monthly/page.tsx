import { formatPKR, sumMoney } from "@/lib/money";
import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { stWhtBatches, glTransactions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "lucide-react";
import { STMonthlyActions } from "./STMonthlyActions";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const AUTHORITY_INFO: Record<
  string,
  { label: string; portal: string; color: string }
> = {
  FBR: {
    label: "FBR (Federal)",
    portal: "iris.fbr.gov.pk",
    color: "bg-blue-100 text-blue-800",
  },
  SRB: {
    label: "SRB (Sindh)",
    portal: "srb.gov.pk",
    color: "bg-emerald-100 text-emerald-800",
  },
  PRA: {
    label: "PRA (Punjab)",
    portal: "pra.punjab.gov.pk",
    color: "bg-purple-100 text-purple-800",
  },
  KPRA: {
    label: "KPRA (KPK)",
    portal: "kpra.gov.pk",
    color: "bg-orange-100 text-orange-800",
  },
  BRA: {
    label: "BRA (Balochistan)",
    portal: "bra.gov.pk",
    color: "bg-rose-100 text-rose-800",
  },
};

export default async function STWHTMonthlyPage({ params }: Props) {
  const [session, { id: companyId }] = await Promise.all([auth(), params]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  // Distinct year/month from ST-tagged GL transactions
  const txnMonthsResult = await db.execute(
    sql`SELECT DISTINCT
          EXTRACT(YEAR  FROM txn_date::date)::int AS year,
          EXTRACT(MONTH FROM txn_date::date)::int AS month
        FROM gl_transactions
        WHERE company_id = ${companyId}
          AND st_wht_tag IS NOT NULL
        ORDER BY year, month`,
  );

  const txnMonths = ((
    txnMonthsResult as unknown as { rows: { year: number; month: number }[] }
  ).rows ?? txnMonthsResult) as { year: number; month: number }[];

  // All existing ST WHT batches
  const batches = await db
    .select()
    .from(stWhtBatches)
    .where(eq(stWhtBatches.companyId, companyId));

  // Group batches by year-month
  type BatchRow = (typeof batches)[number];
  const batchByMonth = batches.reduce<Record<string, BatchRow[]>>((acc, b) => {
    const k = `${b.year}-${b.month}`;
    (acc[k] ??= []).push(b);
    return acc;
  }, {});

  // Count ST-tagged transactions total
  const [{ count: taggedCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(glTransactions)
    .where(
      and(eq(glTransactions.companyId, companyId), sql`st_wht_tag IS NOT NULL`),
    );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">ST WHT — Monthly Batches</h1>
          <p className="text-sm text-muted-foreground">
            Sales Tax Withholding — filed with ST return by{" "}
            <strong>15th</strong> of following month. One batch per authority
            (FBR / SRB / PRA / KPRA / BRA).
          </p>
        </div>
      </div>

      {/* Key differences callout */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        <p className="font-semibold mb-1">ST WHT vs Income WHT</p>
        <div className="grid gap-1 sm:grid-cols-2 text-xs">
          <p>
            📅 <strong>Income WHT:</strong> Deposit by <strong>7th</strong>{" "}
            (challan), statement by 15th
          </p>
          <p>
            📅 <strong>ST WHT:</strong> Return + payment by{" "}
            <strong>15th</strong> (one step, no separate challan)
          </p>
          <p>
            🏛 <strong>Income WHT:</strong> Always FBR IRIS
          </p>
          <p>
            🏛 <strong>ST WHT:</strong> FBR IRIS (goods) + SRB/PRA/KPRA/BRA
            portals (services)
          </p>
        </div>
      </div>

      {taggedCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Calculator className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No ST WHT-tagged transactions yet</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Go to Transactions and set the{" "}
              <span className="font-semibold">ST WHT</span> tag on applicable
              transactions. Use the &ldquo;ST WHT&rdquo; column dropdown —
              select the relevant authority and category.
            </p>
            <Link
              href={`/company/${companyId}/transactions`}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Transactions
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {txnMonths.map(({ year, month }) => {
            const key = `${year}-${month}`;
            const monthBatches = batchByMonth[key] ?? [];
            const period = `${MONTH_NAMES[month - 1]} ${year}`;
            const hasBatches = monthBatches.length > 0;
            const totalWHT = sumMoney(
              monthBatches.map((b) => b.totalWht ?? "0"),
            );
            const allApproved =
              hasBatches && monthBatches.every((b) => b.status !== "draft");

            return (
              <Card key={key}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{period}</span>
                      {allApproved && (
                        <Badge className="bg-green-100 text-green-800">
                          Approved
                        </Badge>
                      )}
                      {!hasBatches && (
                        <Badge variant="secondary">Not calculated</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {hasBatches && (
                        <span className="text-sm text-muted-foreground">
                          Total ST WHT:{" "}
                          <span className="font-semibold text-foreground">
                            {formatPKR(totalWHT)}
                          </span>
                        </span>
                      )}
                      <STMonthlyActions
                        companyId={companyId}
                        year={year}
                        month={month}
                        hasBatches={hasBatches}
                      />
                    </div>
                  </div>

                  {hasBatches && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                            Authority
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                            Portal
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                            Gross
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                            ST Base
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                            ST WHT
                          </th>
                          <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthBatches
                          .sort((a, b) =>
                            a.authority.localeCompare(b.authority),
                          )
                          .map((b) => {
                            const info = AUTHORITY_INFO[b.authority] ?? {
                              label: b.authority,
                              portal: "",
                              color: "bg-muted text-muted-foreground",
                            };
                            return (
                              <tr key={b.id} className="border-b last:border-0">
                                <td className="px-4 py-2">
                                  <Badge className={info.color}>
                                    {info.label}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2 text-xs text-muted-foreground">
                                  {info.portal}
                                </td>
                                <td className="px-4 py-2 text-right text-muted-foreground">
                                  {formatPKR(b.totalGross)}
                                </td>
                                <td className="px-4 py-2 text-right text-muted-foreground">
                                  {formatPKR(b.totalSt)}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold">
                                  {formatPKR(b.totalWht)}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <Badge
                                    className={
                                      b.status === "filed"
                                        ? "bg-green-100 text-green-800"
                                        : b.status === "approved"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-amber-100 text-amber-800"
                                    }
                                  >
                                    {b.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <Link
                                    href={`/company/${companyId}/st-wht/batch/${b.id}`}
                                    className="text-xs text-primary underline hover:no-underline"
                                  >
                                    View
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
