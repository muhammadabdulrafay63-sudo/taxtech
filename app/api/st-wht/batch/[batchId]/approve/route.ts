import { commitBatchApproval } from "@/lib/batch-approval";
import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { stWhtBatches, stWhtLines, stWhtBatchItems } from "@/db/schema";
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
        .from(stWhtBatches)
        .where(eq(stWhtBatches.id, batchId))
        .limit(1);
      if (!batch)
        return NextResponse.json({ error: "Batch not found" }, { status: 404 });
      if (batch.status !== "draft")
        return NextResponse.json(
          { error: "Already approved" },
          { status: 400 },
        );

      try {
        await assertBatchFresh(
          batch.companyId,
          batch.year,
          batch.month,
          batch.createdAt,
          batch.id,
          "sales",
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
        .select({ id: stWhtLines.id })
        .from(stWhtBatchItems)
        .innerJoin(stWhtLines, eq(stWhtBatchItems.stWhtLineId, stWhtLines.id))
        .where(
          and(
            eq(stWhtBatchItems.batchId, batchId),
            eq(stWhtLines.needsReview, true),
          ),
        )
        .limit(1);
      if (unresolved.length)
        return NextResponse.json(
          {
            error:
              "Resolve unknown vendor tax status and recalculate before approving.",
          },
          { status: 409 },
        );
      const approved = await commitBatchApproval(
        batch,
        session.user!.id! as string,
        "sales",
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
