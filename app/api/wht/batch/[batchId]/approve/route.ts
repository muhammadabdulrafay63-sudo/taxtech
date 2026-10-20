import { commitBatchApproval } from "@/lib/batch-approval";
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
  whtLines,
  whtBatchItems,
  vendors,
  whtRules,
} from "@/db/schema";
import { hasRecipientEvidence } from "@/lib/tax-policy";
import { assertBatchFresh } from "@/lib/workflow";
import { eq, and } from "drizzle-orm";

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
      if (batch.status !== "draft")
        return NextResponse.json(
          { error: "Only draft batches can be approved" },
          { status: 400 },
        );

      try {
        await assertBatchFresh(
          batch.companyId,
          batch.year,
          batch.month,
          batch.createdAt,
          batch.id,
          "income",
        );
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Recalculate this batch.",
          },
          { status: 409 },
        );
      }
      const unresolved = await db
        .select({ id: whtLines.id })
        .from(whtBatchItems)
        .innerJoin(whtLines, eq(whtBatchItems.whtLineId, whtLines.id))
        .where(
          and(
            eq(whtBatchItems.batchId, batchId),
            eq(whtLines.needsReview, true),
          ),
        )
        .limit(1);
      if (unresolved.length)
        return NextResponse.json(
          {
            error:
              "Verify vendor tax status and recipient type, then recalculate before approving.",
          },
          { status: 409 },
        );
      // Recheck live evidence too: older drafts may predate the evidence gate.
      const evidence = await db
        .select({
          recipientType: whtRules.recipientType,
          active: whtRules.active,
          vendorType: vendors.recipientType,
          verifiedAt: vendors.recipientTypeVerifiedAt,
          isFiler: vendors.isFiler,
        })
        .from(whtBatchItems)
        .innerJoin(whtLines, eq(whtBatchItems.whtLineId, whtLines.id))
        .leftJoin(whtRules, eq(whtLines.ruleId, whtRules.id))
        .leftJoin(vendors, eq(whtLines.vendorId, vendors.id))
        .where(eq(whtBatchItems.batchId, batchId));
      if (
        !evidence.length ||
        evidence.some(
          (r) =>
            !r.active ||
            r.isFiler === null ||
            !hasRecipientEvidence(
              r.recipientType ?? "unknown",
              r.vendorType
                ? {
                    recipientType: r.vendorType,
                    recipientTypeVerifiedAt: r.verifiedAt,
                  }
                : null,
            ),
        )
      )
        return NextResponse.json(
          {
            error:
              "Verify supplier recipient type and filer status, then recalculate this draft.",
          },
          { status: 409 },
        );
      const approved = await commitBatchApproval(
        batch,
        session.user!.id! as string,
        "income",
      );
      if (!approved)
        return NextResponse.json(
          {
            error:
              "Calculation inputs changed. Recalculate this draft before approval.",
          },
          { status: 409 },
        );

      return NextResponse.json({ ok: true });
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
