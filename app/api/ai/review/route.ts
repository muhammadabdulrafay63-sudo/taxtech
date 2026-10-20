import sourceMap from "@/data/income-source-map.json";
import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { glTransactions, whtRules, auditLogs, vendors } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  classifyEntries,
  validateSuggestions,
  enforceRecipientEvidence,
} from "@/lib/ai/classify";
import { AIError } from "@/lib/ai/nebius";
import { claimAIRequest } from "@/lib/ai/limit";
import { canAccessCompany, needsAIReview } from "@/lib/review-policy";
export const maxDuration = 60;
const bodySchema = z.object({
  companyId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(10),
});
export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const writeCompany = (session!.user as { companyId?: string }).companyId;
  if (!writeCompany)
    return NextResponse.json(
      { error: "No company assigned." },
      { status: 403 },
    );
  try {
    return await withCompanyWrite(writeCompany, async () => {
      try {
        const { companyId, ids } = bodySchema.parse(await req.json());
        if (
          !canAccessCompany(session.user as { companyId?: string }, companyId)
        )
          return NextResponse.json(
            { error: "Access denied." },
            { status: 403 },
          );
        const entries = await db
          .select()
          .from(glTransactions)
          .where(
            and(
              eq(glTransactions.companyId, companyId),
              inArray(glTransactions.id, ids),
            ),
          );
        if (
          entries.length !== new Set(ids).size ||
          entries.some((t) => !needsAIReview(t))
        )
          return NextResponse.json(
            {
              error: "Select only pending, unclear entries from this company.",
            },
            { status: 400 },
          );
        const rules = await db
          .select({
            ruleKey: whtRules.ruleKey,
            section: whtRules.section,
            description: whtRules.description,
            recipientType: whtRules.recipientType,
            usesSlabRates: whtRules.usesSlabRates,
            isTiered: whtRules.isTiered,
          })
          .from(whtRules)
          .where(eq(whtRules.active, true));
        if (!rules.length)
          return NextResponse.json(
            { error: "Set up active tax rules before requesting suggestions." },
            { status: 409 },
          );
        await claimAIRequest(companyId, session.user!.id!, "review");
        const vendorRows = await db
          .select({
            id: vendors.id,
            recipientType: vendors.recipientType,
            checked: vendors.recipientTypeVerifiedAt,
          })
          .from(vendors)
          .where(eq(vendors.companyId, companyId));
        const evidence = entries.map((t) => ({
          id: t.id,
          recipientType:
            vendorRows.find((v) => v.id === t.vendorId && v.checked)
              ?.recipientType ?? null,
        }));
        const response = await classifyEntries(
          entries.map((t) => ({
            id: t.id,
            description: t.description?.slice(0, 1200),
            accountCode: t.accountCode,
            recipientType:
              evidence.find((e) => e.id === t.id)?.recipientType ?? null,
          })),
          rules.filter((r) => r.ruleKey in sourceMap),
        );
        const suggestions = enforceRecipientEvidence(
          validateSuggestions(
            response.result,
            entries.map((t) => t.id),
            rules.map((r) => r.ruleKey),
          ),
          evidence,
          rules,
        );
        const updates = suggestions.map((s) =>
          db
            .update(glTransactions)
            .set({
              aiSuggestion: {
                ruleKey: s.ruleKey,
                explanation: s.explanation,
                missingInformation: s.missingInformation,
                confidence: s.confidence,
                model: response.model,
                generatedAt: new Date().toISOString(),
              },
            })
            .where(
              and(
                eq(glTransactions.id, s.id),
                eq(glTransactions.reviewStatus, "pending"),
              ),
            ),
        );
        await db.batch([
          db.insert(auditLogs).values({
            companyId,
            actorId: session.user!.id!,
            action: "AI_REVIEW",
            entityType: "gl_transaction",
            payload: { ids, model: response.model, usage: response.usage },
          }),
          ...updates,
        ]);
        return NextResponse.json({
          reviewed: suggestions.length,
          model: response.model,
        });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof AIError
                ? error.message
                : error instanceof z.ZodError
                  ? "Invalid review request."
                  : "Unable to save AI suggestions. Your approved categories were not changed.",
          },
          { status: error instanceof AIError ? error.status : 400 },
        );
      }
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
