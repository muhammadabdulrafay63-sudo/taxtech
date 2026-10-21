import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import { companies, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isoDate, amount } from "@/lib/validation";

const body = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  ntn: z.string().nullable().optional(),
  strn: z.string().nullable().optional(),
  financialYearEnd: isoDate.nullable().optional(),
  incorporationDate: isoDate.nullable().optional(),
  registeredOffice: z.string().nullable().optional(),
  paidUpCapital: amount.nullable().optional(),
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

      await db.batch([
        db
          .update(companies)
          .set({
            ...parsed.data,
            paidUpCapital:
              parsed.data.paidUpCapital === undefined
                ? undefined
                : parsed.data.paidUpCapital === null
                  ? null
                  : String(parsed.data.paidUpCapital),
          })
          .where(eq(companies.id, id)),
        db
          .insert(auditLogs)
          .values({
            companyId: id,
            actorId: session.user!.id!,
            action: "UPDATE_COMPANY",
            entityType: "company",
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
