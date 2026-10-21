import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  challanRecords,
  whtBatches,
  auditLogs,
  whtBatchItems,
  whtLines,
  whtRules,
} from "@/db/schema";
import { isoDate } from "@/lib/validation";
import { todayPKT } from "@/lib/dates";
import { eq } from "drizzle-orm";
import { z } from "zod";

const body = z.object({
  cprNumber: z.string().trim().min(1).max(200),
  paymentDate: isoDate.refine((v) => v <= todayPKT()),
  bankName: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ challanId: string }> },
) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user)
    return apiJSON({ error: "Unauthorized" }, { status: 401 });
  const writeCompany = (session!.user as { companyId?: string }).companyId;
  if (!writeCompany)
    return apiJSON(
      { error: "No company assigned." },
      { status: 403 },
    );
  try {
    return await withCompanyWrite(writeCompany, async () => {
      const { challanId } = await params;
      const parsed = body.safeParse(await req.json());
      if (!parsed.success)
        return apiJSON({ error: "Invalid body" }, { status: 400 });

      const [challan] = await db
        .select()
        .from(challanRecords)
        .where(eq(challanRecords.id, challanId))
        .limit(1);
      if (!challan)
        return apiJSON({ error: "Not found" }, { status: 404 });
      if (challan.cprNumber)
        return apiJSON(
          {
            error:
              "This payment is already recorded. Its CPR history cannot be overwritten.",
          },
          { status: 409 },
        );
      const [batch] = await db
        .select()
        .from(whtBatches)
        .where(eq(whtBatches.id, challan.batchId))
        .limit(1);
      if (!batch || !["approved", "paid"].includes(batch.status))
        return apiJSON(
          { error: "Only an approved batch can record an external payment." },
          { status: 409 },
        );

      const update = db
        .update(challanRecords)
        .set({
          cprNumber: parsed.data.cprNumber,
          paymentDate: parsed.data.paymentDate,
          bankName: parsed.data.bankName ?? null,
        })
        .where(eq(challanRecords.id, challanId));

      // Check if all challans for this batch are now paid
      const allChallans = await db
        .select({ id: challanRecords.id, cprNumber: challanRecords.cprNumber })
        .from(challanRecords)
        .where(eq(challanRecords.batchId, challan.batchId));
      const expected = await db
        .selectDistinct({ section: whtRules.section })
        .from(whtBatchItems)
        .innerJoin(whtLines, eq(whtBatchItems.whtLineId, whtLines.id))
        .innerJoin(whtRules, eq(whtLines.ruleId, whtRules.id))
        .where(eq(whtBatchItems.batchId, challan.batchId));
      const sections = await db
        .select({ section: challanRecords.section })
        .from(challanRecords)
        .where(eq(challanRecords.batchId, challan.batchId));
      if (
        !expected.length ||
        expected.length !== sections.length ||
        expected.some((e) => !sections.some((s) => s.section === e.section))
      )
        return apiJSON(
          {
            error:
              "Generate the complete challan set before recording payments. Existing payments will be preserved.",
          },
          { status: 409 },
        );
      const allPaid = allChallans.every(
        (c) => c.id === challanId || c.cprNumber,
      );

      await db.batch([
        update,
        ...(allPaid
          ? [
              db
                .update(whtBatches)
                .set({ status: "paid" })
                .where(eq(whtBatches.id, challan.batchId)),
            ]
          : []),
        db.insert(auditLogs).values({
          companyId: writeCompany,
          actorId: session.user!.id!,
          action: "RECORD_EXTERNAL_PAYMENT",
          entityType: "challan",
          entityId: challanId,
          payload: { paymentDate: parsed.data.paymentDate },
        }),
      ]);

      return apiJSON({ ok: true });
    });
  } catch (error) {
    return apiJSON(
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
