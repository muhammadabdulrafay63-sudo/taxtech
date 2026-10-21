import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import { vendors, auditLogs } from "@/db/schema";
import { z } from "zod";

const body = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  taxId: z.string().nullable().optional(),
  strn: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  recipientType: z.enum(["company", "individual_aop", "non_resident"]),
  isFiler: z.boolean().nullable().optional(),
  isStRegistered: z.boolean().nullable().optional(),
  isNonResident: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
});

export async function POST(req: Request) {
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
      const parsed = body.safeParse(await req.json());
      if (!parsed.success)
        return apiJSON({ error: "Invalid body" }, { status: 400 });

      const id = crypto.randomUUID();
      const [created] = await db.batch([
        db
          .insert(vendors)
          .values({
            id,
            ...parsed.data,
            taxId: parsed.data.taxId ?? null,
            strn: parsed.data.strn ?? null,
            province: parsed.data.province ?? null,
            isFiler: parsed.data.isFiler ?? null,
            recipientTypeVerifiedAt: new Date(),
            atlLastCheckedAt: parsed.data.isFiler != null ? new Date() : null,
            strnLastCheckedAt:
              parsed.data.isStRegistered != null ? new Date() : null,
            isStRegistered: parsed.data.isStRegistered ?? null,
            notes: parsed.data.notes ?? null,
          })
          .returning(),
        db.insert(auditLogs).values({
          companyId: writeCompany,
          actorId: session.user!.id!,
          action: "CREATE_VENDOR",
          entityType: "vendor",
          entityId: id,
        }),
      ]);
      return apiJSON(created[0], { status: 201 });
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
