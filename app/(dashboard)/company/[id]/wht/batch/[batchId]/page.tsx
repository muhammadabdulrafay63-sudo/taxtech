import { formatPKR, sumMoney } from "@/lib/money";
import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  whtBatches,
  whtBatchItems,
  whtLines,
  whtRules,
  vendors,
  glTransactions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { BatchApproveButton } from "./BatchApproveButton";

interface Props {
  params: Promise<{ id: string; batchId: string }>;
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

export default async function BatchDetailPage({ params }: Props) {
  const [session, { id: companyId, batchId }] = await Promise.all([
    auth(),
    params,
  ]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  const [batch] = await db
    .select()
    .from(whtBatches)
    .where(and(eq(whtBatches.id, batchId), eq(whtBatches.companyId, companyId)))
    .limit(1);

  if (!batch) redirect(`/company/${companyId}/wht/monthly`);

  // Load batch lines with all joins
  const lines = await db
    .select({
      id: whtLines.id,
      grossAmount: whtLines.grossAmount,
      whtRate: whtLines.whtRate,
      whtAmount: whtLines.whtAmount,
      taxStatus: whtLines.taxStatus,
      needsReview: whtLines.needsReview,
      ruleKey: whtRules.ruleKey,
      ruleSection: whtRules.section,
      ruleDescription: whtRules.description,
      vendorName: vendors.name,
      vendorIsFiler: vendors.isFiler,
      txnDate: glTransactions.txnDate,
      txnDescription: glTransactions.description,
    })
    .from(whtBatchItems)
    .innerJoin(whtLines, eq(whtBatchItems.whtLineId, whtLines.id))
    .leftJoin(whtRules, eq(whtLines.ruleId, whtRules.id))
    .leftJoin(vendors, eq(whtLines.vendorId, vendors.id))
    .leftJoin(glTransactions, eq(whtLines.glTxnId, glTransactions.id))
    .where(eq(whtBatchItems.batchId, batchId))
    .orderBy(whtLines.grossAmount);

  // Group by section for the summary
  const sectionTotals = lines.reduce<
    Record<string, { gross: string; wht: string; count: number }>
  >((acc, l) => {
    const key = l.ruleSection ?? "Other";
    acc[key] ??= { gross: "0.00", wht: "0.00", count: 0 };
    acc[key].gross = sumMoney([acc[key].gross, l.grossAmount]);
    acc[key].wht = sumMoney([acc[key].wht, l.whtAmount]);
    acc[key].count++;
    return acc;
  }, {});

  const reviewCount = lines.filter((l) => l.needsReview).length;
  const monthLabel = `${MONTH_NAMES[batch.month - 1]} ${batch.year}`;

  const statusColor =
    batch.status === "paid"
      ? "bg-green-100 text-green-800"
      : batch.status === "approved"
        ? "bg-blue-100 text-blue-800"
        : "bg-amber-100 text-amber-800";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href={`/company/${companyId}/wht/monthly`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to batches
          </Link>
          <h1 className="text-xl font-semibold">WHT Batch — {monthLabel}</h1>
          <div className="flex items-center gap-2">
            <Badge className={statusColor}>{batch.status}</Badge>
            {reviewCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {reviewCount} need review
              </Badge>
            )}
          </div>
        </div>
        {batch.status === "draft" && (
          <BatchApproveButton batchId={batchId} companyId={companyId} />
        )}
      </div>

      {/* Review warning */}
      {reviewCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">{reviewCount} lines</span> have
            vendors with missing tax status or recipient evidence. Unknown filer
            status uses a non-filer draft rate. Go to{" "}
            <Link href={`/company/${companyId}/vendors`} className="underline">
              Vendors
            </Link>{" "}
            to verify their filer status and recipient type, then recalculate
            before approving.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Gross" value={formatPKR(batch.totalGross)} />
        <SummaryCard
          label="Total WHT Payable"
          value={formatPKR(batch.totalWht)}
          highlight
        />
        <SummaryCard label="Lines" value={`${lines.length} transactions`} />
      </div>

      {/* Section breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Section-wise Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Section
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Lines
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Gross
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  WHT
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(sectionTotals)
                .sort()
                .map(([section, totals]) => (
                  <tr key={section} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">Section {section}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {totals.count}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {formatPKR(totals.gross)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {formatPKR(totals.wht)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Individual WHT Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Description / Vendor</TableHead>
                  <TableHead className="w-36">Rule</TableHead>
                  <TableHead className="w-24">Rate</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-28 text-right">Gross</TableHead>
                  <TableHead className="w-28 text-right">WHT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow
                    key={line.id}
                    className={
                      line.needsReview
                        ? "bg-amber-50/50 dark:bg-amber-950/10"
                        : undefined
                    }
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {line.txnDate
                        ? new Date(line.txnDate).toLocaleDateString("en-PK", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm max-w-xs">
                        {line.txnDescription || "—"}
                      </p>
                      {line.vendorName && (
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                          {line.vendorName}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{line.ruleKey}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {line.ruleDescription}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {line.whtRate}%
                    </TableCell>
                    <TableCell>
                      {line.taxStatus === "filer" && (
                        <Badge className="bg-green-100 text-green-800 text-[10px]">
                          Filer
                        </Badge>
                      )}
                      {line.taxStatus === "non_filer" && (
                        <Badge className="bg-red-100 text-red-800 text-[10px]">
                          Non-filer
                        </Badge>
                      )}
                      {line.taxStatus === "unknown" && (
                        <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                          <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                          Unknown
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatPKR(line.grossAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPKR(line.whtAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-bold ${highlight ? "text-primary" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
