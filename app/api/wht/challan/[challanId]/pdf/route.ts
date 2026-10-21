import { guardRoute } from "@/lib/route-guard";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  challanRecords,
  whtBatches,
  whtBatchItems,
  whtLines,
  whtRules,
  vendors,
  glTransactions,
  companies,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { ChallanDocument } from "@/components/pdf/ChallanDocument";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ challanId: string }> },
) {
  const denied = await guardRoute(_req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user)
    return apiJSON({ error: "Unauthorized" }, { status: 401 });

  const { challanId } = await params;

  const [challan] = await db
    .select()
    .from(challanRecords)
    .where(eq(challanRecords.id, challanId))
    .limit(1);
  if (!challan)
    return apiJSON({ error: "Not found" }, { status: 404 });

  const [batch] = await db
    .select()
    .from(whtBatches)
    .where(eq(whtBatches.id, challan.batchId))
    .limit(1);
  const [company] = await db
    .select({ name: companies.name, ntn: companies.ntn })
    .from(companies)
    .where(eq(companies.id, batch.companyId))
    .limit(1);

  // Get lines for this section
  const lines = await db
    .select({
      grossAmount: whtLines.grossAmount,
      whtRate: whtLines.whtRate,
      whtAmount: whtLines.whtAmount,
      taxStatus: whtLines.taxStatus,
      ruleKey: whtRules.ruleKey,
      ruleSection: whtRules.section,
      ruleDescription: whtRules.description,
      vendorName: vendors.name,
      txnDescription: glTransactions.description,
    })
    .from(whtBatchItems)
    .innerJoin(whtLines, eq(whtBatchItems.whtLineId, whtLines.id))
    .leftJoin(whtRules, eq(whtLines.ruleId, whtRules.id))
    .leftJoin(vendors, eq(whtLines.vendorId, vendors.id))
    .leftJoin(glTransactions, eq(whtLines.glTxnId, glTransactions.id))
    .where(eq(whtBatchItems.batchId, challan.batchId))
    .then((rows) => rows.filter((r) => r.ruleSection === challan.section));

  const period = `${MONTH_NAMES[batch.month - 1]} ${batch.year}`;

  const buffer = await renderToBuffer(
    ChallanDocument({
      companyName: company.name,
      companyNtn: company.ntn,
      period,
      section: challan.section,
      paymentHeadCode: challan.paymentHeadCode,
      lines: lines.map((l) => ({
        ruleKey: l.ruleKey ?? "",
        description: l.txnDescription ?? "",
        vendorName: l.vendorName ?? null,
        grossAmount: l.grossAmount,
        whtRate: l.whtRate,
        whtAmount: l.whtAmount,
        taxStatus: l.taxStatus,
      })),
      totalGross: challan.totalGross,
      totalWht: challan.totalWht,
      generatedAt: new Date().toLocaleDateString("en-PK"),
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="challan-sec${challan.section}-${period.replace(" ", "-")}.pdf"`,
    },
  });
}
