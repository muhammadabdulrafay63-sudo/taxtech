import { guardRoute } from "@/lib/route-guard";
import { auth } from "@/auth";
import { db } from "@/db";
import { secpCompanies, secpObligations, auditLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { isoDate } from "@/lib/validation";
import {
  eventRules,
  addCalendarDays,
  generateAnnualObligations,
} from "@/lib/secp";
import { withCompanyWrite, WorkflowError } from "@/lib/workflow";
import { NextResponse } from "next/server";
const body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("event"),
    filingType: z.enum(
      Object.keys(eventRules) as [
        keyof typeof eventRules,
        ...(keyof typeof eventRules)[],
      ],
    ),
    triggerDate: isoDate,
    notes: z.string().trim().min(3).max(2000),
  }),
  z.object({
    kind: z.literal("annual"),
    year: z.number().int().min(1900).max(2200),
  }),
  z.object({
    kind: z.literal("manual"),
    label: z.string().trim().min(3).max(100),
    dueDate: isoDate,
    notes: z.string().trim().min(3).max(2000),
  }),
]);
export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  const companyId = (session!.user as { companyId: string }).companyId;
  const parsed = body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the event and dates." },
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
        return NextResponse.json(
          { error: "Set up the SECP profile first." },
          { status: 409 },
        );
      const input = parsed.data;
      if (
        input.kind === "annual" &&
        (
          await db
            .select({ id: secpObligations.id })
            .from(secpObligations)
            .where(
              and(
                eq(secpObligations.secpCompanyId, profile.id),
                eq(secpObligations.periodYear, input.year),
                eq(secpObligations.origin, "annual"),
              ),
            )
            .limit(1)
        ).length
      )
        return NextResponse.json(
          { error: "This fiscal year's calendar already exists." },
          { status: 409 },
        );
      const rows =
        input.kind === "annual"
          ? generateAnnualObligations(
              new Date(profile.financialYearEnd),
              input.year,
              profile.incorporationDate,
            ).map((o) => ({
              ...o,
              secpCompanyId: profile.id,
              origin: "annual",
            }))
          : input.kind === "event"
            ? [
                {
                  secpCompanyId: profile.id,
                  filingType: input.filingType,
                  triggerDate: input.triggerDate,
                  dueDate: addCalendarDays(
                    input.triggerDate,
                    eventRules[input.filingType].days,
                  ),
                  notes: input.notes,
                  origin: "event",
                },
              ]
            : [
                {
                  secpCompanyId: profile.id,
                  filingType: input.label,
                  dueDate: input.dueDate,
                  notes: input.notes,
                  origin: "manual",
                },
              ];
      if (!rows.length)
        return NextResponse.json(
          { error: "This year precedes incorporation." },
          { status: 400 },
        );
      await db.batch([
        db.insert(secpObligations).values(rows),
        db
          .insert(auditLogs)
          .values({
            companyId,
            actorId: session!.user!.id!,
            action: "CREATE_SECP_OBLIGATION",
            entityType: "secp_obligation",
            payload: input,
          }),
      ]);
      return NextResponse.json({ ok: true, created: rows.length });
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof WorkflowError
            ? e.message
            : "Could not save calendar event.",
      },
      { status: e instanceof WorkflowError ? 409 : 500 },
    );
  }
}
