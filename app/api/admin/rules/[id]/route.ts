import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import { whtRules, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const body = z.object({
  description: z.string().optional(),
  rateFiler: z.number().min(0).max(100).multipleOf(0.001).optional(),
  rateNonFiler: z.number().min(0).max(100).multipleOf(0.001).optional(),
  thresholdAmount: z
    .number()
    .min(0)
    .max(999999999999.99)
    .multipleOf(0.01)
    .optional(),
  keywords: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (
    !session?.user ||
    (session.user as { role?: string }).role !== "superadmin"
  ) {
    return apiJSON({ error: "Forbidden" }, { status: 403 });
  }
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
        return apiJSON({ error: "Invalid" }, { status: 400 });

      await db.batch([
        db
          .update(whtRules)
          .set({
            ...parsed.data,
            rateFiler: parsed.data.rateFiler?.toFixed(3),
            rateNonFiler: parsed.data.rateNonFiler?.toFixed(3),
            thresholdAmount: parsed.data.thresholdAmount?.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(whtRules.id, parseInt(id))),
        db.insert(auditLogs).values({
          actorId: session.user!.id! as string,
          action: "EDIT_WHT_RULE",
          entityType: "wht_rule",
          entityId: id,
          payload: parsed.data,
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
