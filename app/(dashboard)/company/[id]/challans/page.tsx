import { formatPKR } from "@/lib/money";
import { requireCompany } from "@/lib/page-access";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { whtBatches, challanRecords } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiptText } from "lucide-react";
import { ChallanActions } from "./ChallanActions";
import { MarkPaidDialog } from "./MarkPaidDialog";

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



export default async function ChallansPage({ params }: Props) {
  const [session, { id: companyId }] = await Promise.all([auth(), params]);
  if (!session?.user) redirect("/login");
  await requireCompany(companyId);

  const approvedBatches = await db
    .select()
    .from(whtBatches)
    .where(
      and(
        eq(whtBatches.companyId, companyId),
        inArray(whtBatches.status, ["approved", "paid"]),
      ),
    )
    .orderBy(whtBatches.year, whtBatches.month);

  const batchIds = approvedBatches.map((b) => b.id);
  const challans =
    batchIds.length > 0
      ? await db
          .select()
          .from(challanRecords)
          .where(inArray(challanRecords.batchId, batchIds))
      : [];

  const challansByBatch = challans.reduce<Record<string, typeof challans>>(
    (acc, c) => {
      (acc[c.batchId] ??= []).push(c);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">WHT Challans</h1>
        <p className="text-sm text-muted-foreground">
          Generate payment challans for approved batches. One challan per WHT
          section per month.
        </p>
      </div>

      {approvedBatches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ReceiptText className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No approved batches yet</p>
            <p className="text-sm text-muted-foreground">
              Approve a monthly WHT batch to generate challans.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvedBatches.map((batch) => {
            const batchChallans = challansByBatch[batch.id] ?? [];
            const period = `${MONTH_NAMES[batch.month - 1]} ${batch.year}`;
            return (
              <Card key={batch.id}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{period}</span>
                      <Badge
                        className={
                          batch.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }
                      >
                        {batch.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        Total WHT:{" "}
                        <span className="font-semibold text-foreground">
                          {formatPKR(batch.totalWht)}
                        </span>
                      </span>
                      <ChallanActions
                        batchId={batch.id}
                        haChallans={batchChallans.length > 0}
                      />
                    </div>
                  </div>

                  {batchChallans.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-muted-foreground">
                      Click &quot;Generate Challans&quot; to create section-wise
                      payment challans.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                            Section
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                            Gross
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                            WHT Payable
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                            CPR Number
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchChallans.map((c) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="px-4 py-3 font-medium">
                              Section {c.section}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {formatPKR(c.totalGross)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {formatPKR(c.totalWht)}
                            </td>
                            <td className="px-4 py-3">
                              {c.cprNumber ? (
                                <span className="font-mono text-xs text-green-700">
                                  {c.cprNumber}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Not paid yet
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <a
                                  href={`/api/wht/challan/${c.id}/pdf`}
                                  target="_blank"
                                  className="text-xs text-primary underline hover:no-underline"
                                >
                                  Download PDF
                                </a>
                                {!c.cprNumber && (
                                  <MarkPaidDialog
                                    challanId={c.id}
                                    section={c.section}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
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
