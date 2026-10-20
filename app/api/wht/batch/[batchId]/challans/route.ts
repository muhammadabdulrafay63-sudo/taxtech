import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  whtBatches,
  whtBatchItems,
  whtLines,
  whtRules,
  vendors,
  glTransactions,
  challanRecords,
  auditLogs,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { sumMoney } from "@/lib/money";

// GET — list challans for a batch
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const denied = await guardRoute(_req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { batchId } = await params;
  const rows = await db
    .select()
    .from(challanRecords)
    .where(eq(challanRecords.batchId, batchId));
  return NextResponse.json(rows);
}

// POST — generate challan PDFs for an approved batch (one per section)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const denied = await guardRoute(_req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const writeCompany = (session!.user as { companyId?: string }).companyId;
  if (!writeCompany)
    return NextResponse.json(
      { error: "No company assigned." },
      { status: 403 },
    );
  try {
    return await withCompanyWrite(writeCompany, async () => {
      const { batchId } = await params;

      const [batch] = await db
        .select()
        .from(whtBatches)
        .where(eq(whtBatches.id, batchId))
        .limit(1);
      if (!batch)
        return NextResponse.json({ error: "Batch not found" }, { status: 404 });
      if (batch.status === "draft")
        return NextResponse.json(
          { error: "Approve the batch first" },
          { status: 400 },
        );

      // Load all lines with joins
      const lines = await db
        .select({
          id: whtLines.id,
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
        .where(eq(whtBatchItems.batchId, batchId));

      // Group by section
      const bySection = lines.reduce<Record<string, typeof lines>>((acc, l) => {
        const k = l.ruleSection ?? "other";
        (acc[k] ??= []).push(l);
        return acc;
      }, {});

      const existing = await db
        .select()
        .from(challanRecords)
        .where(eq(challanRecords.batchId, batchId));
      const expected = Object.keys(bySection);
      if (
        !expected.length ||
        existing.some((c) => !expected.includes(c.section))
      )
        return NextResponse.json(
          {
            error:
              "This batch has inconsistent section records. Ask the responsible accountant to reconcile it.",
          },
          { status: 409 },
        );
      const missing = expected.filter(
        (section) => !existing.some((c) => c.section === section),
      );
      if (missing.length) {
        const values = missing.map((section) => ({
          batchId,
          section,
          totalGross: sumMoney(bySection[section].map((l) => l.grossAmount)),
          totalWht: sumMoney(bySection[section].map((l) => l.whtAmount)),
        }));
        await db.batch([
          db.insert(challanRecords).values(values).onConflictDoNothing(),
          db
            .update(whtBatches)
            .set({ status: "approved" })
            .where(eq(whtBatches.id, batchId)),
          db
            .insert(auditLogs)
            .values({
              companyId: batch.companyId,
              actorId: session.user!.id!,
              action: "GENERATE_CHALLANS",
              entityType: "wht_batch",
              entityId: batchId,
              payload: { sections: missing },
            }),
        ]);
      }

      return NextResponse.json({
        created: expected.length,
        added: missing.length,
        sections: Object.keys(bySection),
      });
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof WriteConflict
            ? error.message
            : "Unable to complete the change. Please retry.",
      },
      { status: error instanceof WriteConflict ? 409 : 500 },
    );
  }
}
