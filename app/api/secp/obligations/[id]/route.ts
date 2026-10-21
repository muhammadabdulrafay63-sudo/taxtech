import { todayPKT } from "@/lib/dates";
import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import { secpObligations, auditLogs } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { isoDate } from "@/lib/validation";
import { addCalendarDays } from "@/lib/secp";

const body = z.object({
  status: z.enum(["pending", "filed", "overdue", "waived"]).optional(),
  filedDate: isoDate.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  dueDate: isoDate.optional(),
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
        return apiJSON({ error: "Invalid" }, { status: 400 });

      const [existing] = await db
        .select()
        .from(secpObligations)
        .where(eq(secpObligations.id, id))
        .limit(1);
      if (!existing)
        return apiJSON(
          { error: "Obligation not found." },
          { status: 404 },
        );
      if (parsed.data.dueDate) {
        if (
          existing.origin !== "legacy" ||
          ["filed", "waived"].includes(existing.status)
        )
          return apiJSON(
            {
              error: "Only an unfiled legacy schedule can be reconciled here.",
            },
            { status: 409 },
          );
        if (!parsed.data.notes || parsed.data.notes.trim().length < 3)
          return apiJSON(
            { error: "Record the source evidence for this deadline." },
            { status: 400 },
          );
        await db.batch([
          db
            .update(secpObligations)
            .set({
              dueDate: parsed.data.dueDate,
              notes: parsed.data.notes,
              origin: "manual",
              provisional: false,
              status: parsed.data.dueDate < todayPKT() ? "overdue" : "pending",
            })
            .where(eq(secpObligations.id, id)),
          db
            .insert(auditLogs)
            .values({
              companyId: writeCompany,
              actorId: session.user!.id!,
              action: "RECONCILE_LEGACY_CALENDAR",
              entityType: "secp_obligation",
              entityId: id,
              payload: { previous: existing, updated: parsed.data },
            }),
        ]);
        return apiJSON({ ok: true });
      }
      const nextStatus = parsed.data.status ?? existing.status;
      const filedDate =
        parsed.data.filedDate === undefined
          ? existing.filedDate
          : parsed.data.filedDate;
      if (nextStatus === "filed" && (!filedDate || filedDate > todayPKT()))
        return apiJSON(
          {
            error: "Enter the actual filing or AGM date, no later than today.",
          },
          { status: 400 },
        );
      if (
        nextStatus === "filed" &&
        (existing.provisional || existing.origin === "legacy")
      )
        return apiJSON(
          {
            error:
              "Record the actual AGM for provisional filings, or reconcile the legacy deadline from evidence, before marking complete.",
          },
          { status: 409 },
        );
      const dependents =
        existing.filingType === "AGM" && existing.periodYear
          ? await db
              .select()
              .from(secpObligations)
              .where(
                and(
                  eq(secpObligations.secpCompanyId, existing.secpCompanyId),
                  eq(secpObligations.periodYear, existing.periodYear),
                  inArray(secpObligations.filingType, [
                    "FORM_A",
                    "FORM_28",
                    "AUDITED_ACCOUNTS",
                  ]),
                ),
              )
          : [];
      if (
        existing.filingType === "AGM" &&
        existing.status === "filed" &&
        (nextStatus !== "filed" || filedDate !== existing.filedDate) &&
        dependents.some((o) => ["filed", "waived"].includes(o.status))
      )
        return apiJSON(
          {
            error:
              "Filed dependent obligations exist. Preserve their history; ask the responsible accountant to reconcile the record.",
          },
          { status: 409 },
        );
      const updates = dependents
        .filter((o) => !["filed", "waived"].includes(o.status))
        .map((o) => {
          const days = o.filingType === "FORM_28" ? 15 : 30;
          const trigger =
            nextStatus === "filed" ? filedDate! : existing.dueDate;
          const dueDate = addCalendarDays(trigger, days);
          return db
            .update(secpObligations)
            .set({
              dueDate,
              triggerDate: trigger,
              provisional: nextStatus !== "filed",
              status: dueDate < todayPKT() ? "overdue" : "pending",
              notes: `${nextStatus === "filed" ? "Recorded" : "Provisional"} AGM + ${days} days.`,
            })
            .where(eq(secpObligations.id, o.id));
        });
      await db.batch([
        db
          .update(secpObligations)
          .set({
            ...parsed.data,
            filedDate: nextStatus === "filed" ? filedDate : null,
          })
          .where(eq(secpObligations.id, id)),
        ...updates,
        db.insert(auditLogs).values({
          companyId: writeCompany,
          actorId: session.user!.id!,
          action: "UPDATE_SECP_OBLIGATION",
          entityType: "secp_obligation",
          entityId: id,
          payload: { previous: existing, updated: parsed.data },
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
