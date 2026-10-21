import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import { glTransactions, auditLogs, stWhtRules } from "@/db/schema";
import { assertPeriodEditable } from "@/lib/workflow";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const body = z.object({
  stWhtTag: z.string().nullable(), // null = remove ST WHT tag
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
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
      const { id } = await params;
      const parsed = body.safeParse(await req.json());
      if (!parsed.success)
        return apiJSON({ error: "Invalid body" }, { status: 400 });

      const [txn] = await db
        .select({
          companyId: glTransactions.companyId,
          txnDate: glTransactions.txnDate,
        })
        .from(glTransactions)
        .where(eq(glTransactions.id, id))
        .limit(1);
      if (!txn)
        return apiJSON({ error: "Not found" }, { status: 404 });

      try {
        await assertPeriodEditable(
          txn.companyId,
          Number(txn.txnDate.slice(0, 4)),
          Number(txn.txnDate.slice(5, 7)),
        );
      } catch {
        return apiJSON(
          { error: "This period is approved and locked." },
          { status: 409 },
        );
      }
      if (
        parsed.data.stWhtTag &&
        !(
          await db
            .select({ id: stWhtRules.id })
            .from(stWhtRules)
            .where(
              and(
                eq(stWhtRules.ruleKey, parsed.data.stWhtTag),
                eq(stWhtRules.active, true),
              ),
            )
            .limit(1)
        ).length
      )
        return apiJSON(
          { error: "Invalid sales-tax rule." },
          { status: 400 },
        );
      await db.batch([
        db
          .update(glTransactions)
          .set({
            stWhtTag: parsed.data.stWhtTag,
            reviewStatus: "pending",
            reviewedAt: null,
            reviewedBy: null,
            reviewNote: null,
          })
          .where(eq(glTransactions.id, id)),
        db.insert(auditLogs).values({
          companyId: txn.companyId,
          actorId: session.user!.id! as string,
          action: "UPDATE_ST_WHT_TAG",
          entityType: "gl_transaction",
          entityId: id,
          payload: { stWhtTag: parsed.data.stWhtTag },
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
