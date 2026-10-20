import { formatPKR } from "@/lib/money";
import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  stWhtBatches,
  stWhtBatchItems,
  stWhtLines,
  stWhtRules,
  vendors,
  glTransactions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { STBatchApproveButton } from "./STBatchApproveButton";

interface Props {
  params: Promise<{ id: string; batchId: string }>;
}

const AUTHORITY_INFO: Record<
  string,
  { label: string; portal: string; deadline: string }
> = {
  FBR: {
    label: "FBR — Federal Board of Revenue",
    portal: "iris.fbr.gov.pk",
    deadline: "15th of following month",
  },
  SRB: {
    label: "SRB — Sindh Revenue Board",
    portal: "srb.gov.pk",
    deadline: "15th of following month",
  },
  PRA: {
    label: "PRA — Punjab Revenue Authority",
    portal: "pra.punjab.gov.pk",
    deadline: "15th of following month",
  },
  KPRA: {
    label: "KPRA — KPK Revenue Authority",
    portal: "kpra.gov.pk",
    deadline: "15th of following month",
  },
  BRA: {
    label: "BRA — Balochistan Revenue Auth.",
    portal: "bra.gov.pk",
    deadline: "15th of following month",
  },
};



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

export default async function STBatchDetailPage({ params }: Props) {
  const [session, { id: companyId, batchId }] = await Promise.all([
    auth(),
    params,
  ]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  const [batch] = await db
    .select()
    .from(stWhtBatches)
    .where(eq(stWhtBatches.id, batchId))
    .limit(1);
  if (!batch || batch.companyId !== companyId)
    redirect(`/company/${companyId}/st-wht/monthly`);

  const lines = await db
    .select({
      id: stWhtLines.id,
      grossAmount: stWhtLines.grossAmount,
      stRate: stWhtLines.stRate,
      stAmount: stWhtLines.stAmount,
      whtFactor: stWhtLines.whtFactor,
      whtAmount: stWhtLines.whtAmount,
      stRegisteredStatus: stWhtLines.stRegisteredStatus,
      needsReview: stWhtLines.needsReview,
      ruleKey: stWhtRules.ruleKey,
      ruleDesc: stWhtRules.description,
      vendorName: vendors.name,
      txnDescription: glTransactions.description,
      txnDate: glTransactions.txnDate,
    })
    .from(stWhtBatchItems)
    .innerJoin(stWhtLines, eq(stWhtBatchItems.stWhtLineId, stWhtLines.id))
    .leftJoin(stWhtRules, eq(stWhtLines.ruleId, stWhtRules.id))
    .leftJoin(vendors, eq(stWhtLines.vendorId, vendors.id))
    .leftJoin(glTransactions, eq(stWhtLines.glTxnId, glTransactions.id))
    .where(eq(stWhtBatchItems.batchId, batchId));

  const needsReviewCount = lines.filter((l) => l.needsReview).length;
  const info = AUTHORITY_INFO[batch.authority] ?? {
    label: batch.authority,
    portal: "",
    deadline: "15th of following month",
  };
  const period = `${MONTH_NAMES[batch.month - 1]} ${batch.year}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              ST WHT Batch — {info.label}
            </h1>
            <Badge
              className={
                batch.status === "filed"
                  ? "bg-green-100 text-green-800"
                  : batch.status === "approved"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-amber-100 text-amber-800"
              }
            >
              {batch.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{period}</p>
        </div>
        {batch.status === "draft" && (
          <STBatchApproveButton batchId={batchId} companyId={companyId} />
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Gross Amount</p>
            <p className="mt-1 text-xl font-bold">{formatPKR(batch.totalGross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">ST on Invoices</p>
            <p className="mt-1 text-xl font-bold">{formatPKR(batch.totalSt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">ST WHT Payable</p>
            <p className="mt-1 text-xl font-bold text-primary">
              {formatPKR(batch.totalWht)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Filing Deadline</p>
            <p className="mt-1 text-sm font-bold">{info.deadline}</p>
            <p className="text-xs text-muted-foreground">{info.portal}</p>
          </CardContent>
        </Card>
      </div>

      {/* Important note */}
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Filing Instructions — {info.label}</p>
        <p className="text-muted-foreground text-xs mt-1">
          ST WHT is <strong>not</strong> deposited via a separate CPR challan
          like Income WHT. It is included in your monthly ST return on{" "}
          <span className="font-medium">{info.portal}</span>. File by 15th of
          the following month. Input tax credit is available on withheld amount.
        </p>
      </div>

      {/* Warnings */}
      {needsReviewCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">{needsReviewCount} lines</span> have
            unknown STRN status — full withholding applied as safe default.
            Verify STRN on FBR ATL and update vendor profile.
          </p>
        </div>
      )}

      {/* Lines table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Transaction Lines — {lines.length} items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Vendor / Description
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Rule
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  ST Status
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Gross
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  ST Rate
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  ST Base
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  WHT Factor
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  ST WHT
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={l.id}
                  className={`border-b last:border-0 ${l.needsReview ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                >
                  <td className="px-4 py-2">
                    <p className="font-medium">{l.vendorName ?? "(Unknown)"}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {l.txnDescription}
                    </p>
                    <p className="text-xs text-muted-foreground">{l.txnDate}</p>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    <span className="font-mono">{l.ruleKey}</span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      className={
                        l.stRegisteredStatus === "registered"
                          ? "bg-green-100 text-green-800"
                          : l.stRegisteredStatus === "unregistered"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      }
                    >
                      {l.stRegisteredStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatPKR(l.grossAmount)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {parseFloat(l.stRate).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2 text-right">{formatPKR(l.stAmount)}</td>
                  <td className="px-4 py-2 text-right text-xs">
                    {parseFloat(l.whtFactor) === 1
                      ? "Full (100%)"
                      : "1/5th (20%)"}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {formatPKR(l.whtAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/30">
                <td colSpan={5} className="px-4 py-2 font-semibold">
                  Total
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  {formatPKR(batch.totalSt)}
                </td>
                <td />
                <td className="px-4 py-2 text-right font-bold text-primary">
                  {formatPKR(batch.totalWht)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
