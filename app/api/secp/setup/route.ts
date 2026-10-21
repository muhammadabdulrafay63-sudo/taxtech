import { todayPKT } from "@/lib/dates";
import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import { secpCompanies, secpObligations, auditLogs } from "@/db/schema";
import { randomUUID } from "node:crypto";
import { isValidISODate } from "@/lib/review-policy";
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import { generateAnnualObligations, addCalendarDays } from "@/lib/secp";

const body = z.object({
  companyId: z.string().uuid(),
  incorporationDate: z.string().refine(isValidISODate),
  financialYearEnd: z.string().refine(isValidISODate), // e.g. "2024-06-30"
  paidUpCapital: z.number().finite().min(0).optional(),
  officerCount: z.number().int().min(1).max(10000).nullable().optional(),
  registeredOffice: z.string().optional(),
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

      const {
        companyId,
        incorporationDate,
        financialYearEnd,
        paidUpCapital,
        registeredOffice,
        officerCount,
      } = parsed.data;

      const [existing] = await db
        .select()
        .from(secpCompanies)
        .where(eq(secpCompanies.companyId, companyId))
        .limit(1);
      if (existing)
        return apiJSON(
          {
            error:
              "A compliance calendar already exists. Update its individual obligations; setup cannot replace filing history.",
          },
          { status: 409 },
        );
      const secpCo = { id: randomUUID() };
      // Generate obligations for current and next year
      const fye = new Date(financialYearEnd);
      const currentYear = new Date().getFullYear();
      const years = [currentYear - 1, currentYear, currentYear + 1];

      const allObligations = years.flatMap((y) =>
        generateAnnualObligations(fye, y, incorporationDate),
      );
      await db.batch([
        db.insert(secpCompanies).values({
          id: secpCo.id,
          companyId,
          incorporationDate,
          financialYearEnd,
          paidUpCapital: paidUpCapital?.toString(),
          registeredOffice,
          officerCount,
        }),
        db.insert(secpObligations).values(
          allObligations.map((o) => ({
            secpCompanyId: secpCo.id,
            filingType: o.filingType,
            dueDate: o.dueDate,
            triggerDate: o.triggerDate ?? null,
            status: new Date(o.dueDate) < new Date() ? "overdue" : "pending",
            notes: o.notes,
            periodYear: o.periodYear,
            provisional: o.provisional ?? false,
            origin: "annual",
          })),
        ),
      ]);

      return apiJSON({
        secpCompanyId: secpCo.id,
        obligations: allObligations.length,
      });
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

export async function PATCH(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  const companyId = (session!.user as { companyId: string }).companyId;
  const input = body.safeParse(await req.json());
  if (!input.success)
    return apiJSON(
      { error: "Check profile dates and amounts." },
      { status: 400 },
    );
  try {
    return await withCompanyWrite(companyId, async () => {
      const [profile] = await db
        .select()
        .from(secpCompanies)
        .where(eq(secpCompanies.companyId, companyId))
        .limit(1);
      if (!profile)
        return apiJSON(
          { error: "Set up a profile first." },
          { status: 404 },
        );
      const existing = await db
        .select()
        .from(secpObligations)
        .where(eq(secpObligations.secpCompanyId, profile.id));
      const profileUpdate = db
        .update(secpCompanies)
        .set({
          incorporationDate: input.data.incorporationDate,
          financialYearEnd: input.data.financialYearEnd,
          registeredOffice: input.data.registeredOffice,
          paidUpCapital: input.data.paidUpCapital?.toString(),
          officerCount: input.data.officerCount,
        })
        .where(eq(secpCompanies.id, profile.id));
      const changes: BatchItem<"pg">[] = [];
      const years = [
        ...new Set(
          existing
            .filter((o) => o.origin === "annual" && o.periodYear)
            .map((o) => o.periodYear!),
        ),
      ];
      for (const year of years) {
        const actualAgm = existing.find(
          (o) =>
            o.periodYear === year &&
            o.filingType === "AGM" &&
            o.status === "filed",
        )?.filedDate;
        const generated = generateAnnualObligations(
          new Date(input.data.financialYearEnd),
          year,
          input.data.incorporationDate,
        );
        for (const row of existing.filter(
          (o) =>
            o.origin === "annual" &&
            o.periodYear === year &&
            !["filed", "waived"].includes(o.status),
        )) {
          const next = generated.find((o) => o.filingType === row.filingType);
          if (!next) continue;
          const days = row.filingType === "FORM_28" ? 15 : 30;
          const dependent = ["FORM_A", "FORM_28", "AUDITED_ACCOUNTS"].includes(
            row.filingType,
          );
          const due =
            dependent && actualAgm
              ? addCalendarDays(actualAgm, days)
              : next.dueDate;
          changes.push(
            db
              .update(secpObligations)
              .set({
                dueDate: due,
                triggerDate:
                  dependent && actualAgm ? actualAgm : next.triggerDate,
                provisional: dependent && !actualAgm,
                status: due < todayPKT() ? "overdue" : "pending",
                notes:
                  dependent && actualAgm
                    ? `Due ${days} days after recorded AGM.`
                    : next.notes,
              })
              .where(eq(secpObligations.id, row.id)),
          );
        }
      }
      await db.batch([
        profileUpdate,
        ...changes,
        db
          .insert(auditLogs)
          .values({
            companyId,
            actorId: session!.user!.id!,
            action: "EDIT_SECP_PROFILE",
            entityType: "secp_company",
            entityId: profile.id,
            payload: { previous: profile, updated: input.data },
          }),
      ]);
      return apiJSON({ ok: true, obligations: existing.length });
    });
  } catch (error) {
    return apiJSON(
      {
        error:
          error instanceof WriteConflict
            ? error.message
            : "Could not update profile.",
      },
      { status: error instanceof WriteConflict ? 409 : 500 },
    );
  }
}
