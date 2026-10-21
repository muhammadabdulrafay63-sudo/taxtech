import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import { vendors, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isoDate } from "@/lib/validation";

const body = z.object({
  isFiler: z.boolean().nullable().optional(),
  isStRegistered: z.boolean().nullable().optional(),
  strn: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  recipientType: z
    .enum(["company", "individual_aop", "non_resident"])
    .optional(),
  isExempt: z.boolean().optional(),
  exemptionCertExpiry: isoDate.nullable().optional(),
  taxId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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

      const [vendor] = await db
        .select({ companyId: vendors.companyId })
        .from(vendors)
        .where(eq(vendors.id, id))
        .limit(1);
      if (!vendor)
        return apiJSON({ error: "Not found" }, { status: 404 });

      await db.batch([
        db
          .update(vendors)
          .set({
            ...parsed.data,
            recipientTypeVerifiedAt:
              parsed.data.recipientType !== undefined ? new Date() : undefined,
            atlLastCheckedAt:
              parsed.data.isFiler !== undefined ? new Date() : undefined,
            strnLastCheckedAt:
              parsed.data.isStRegistered !== undefined ? new Date() : undefined,
          })
          .where(eq(vendors.id, id)),
        db.insert(auditLogs).values({
          companyId: vendor.companyId,
          actorId: session.user!.id! as string,
          action: "UPDATE_VENDOR",
          entityType: "vendor",
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
