import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  glTransactions,
  whtRules,
  stWhtRules,
  vendors,
  auditLogs,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { assertPeriodEditable } from "@/lib/workflow";
import { validateTaxAssessment } from "@/lib/tax-assessment";
const schema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "excluded", "pending"]),
  ruleKey: z.string().nullable(),
  stRuleKey: z.string().nullable(),
  note: z.string().trim().min(3).max(1200),
  rememberVendor: z.boolean().default(false),
  expectedSuggestionAt: z.string().nullable().optional(),
  taxAssessment: z.unknown().optional(),
});
export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user)
    return apiJSON({ error: "Please sign in." }, { status: 401 });
  const writeCompany = (session!.user as { companyId?: string }).companyId;
  if (!writeCompany)
    return apiJSON({ error: "No company assigned." }, { status: 403 });
  try {
    return await withCompanyWrite(writeCompany, async () => {
      try {
        const input = schema.parse(await req.json());
        const companyId = (session.user as { companyId?: string }).companyId;
        if (!companyId)
          return apiJSON({ error: "No company assigned." }, { status: 403 });
        const [txn] = await db
          .select()
          .from(glTransactions)
          .where(
            and(
              eq(glTransactions.id, input.id),
              eq(glTransactions.companyId, companyId),
            ),
          )
          .limit(1);
        if (!txn)
          return apiJSON({ error: "Transaction not found." }, { status: 404 });
        await assertPeriodEditable(
          companyId,
          Number(txn.txnDate.slice(0, 4)),
          Number(txn.txnDate.slice(5, 7)),
        );
        if (input.decision === "pending") {
          if (txn.reviewStatus === "pending")
            return apiJSON(
              { error: "This entry is already pending." },
              { status: 409 },
            );
          await db.batch([
            db
              .update(glTransactions)
              .set({
                reviewStatus: "pending",
                reviewNote: null,
                reviewedAt: null,
                reviewedBy: null,
                taxAssessment: null,
              })
              .where(eq(glTransactions.id, txn.id)),
            db.insert(auditLogs).values({
              companyId,
              actorId: session.user!.id!,
              action: "REVIEW_TRANSACTION",
              entityType: "gl_transaction",
              entityId: txn.id,
              payload: { decision: "pending", note: input.note },
            }),
          ]);
          return apiJSON({ ok: true });
        }
        if (txn.reviewStatus !== "pending")
          return apiJSON(
            {
              error: "This entry has already been reviewed. Refresh the page.",
            },
            { status: 409 },
          );
        if (
          input.expectedSuggestionAt !== undefined &&
          (txn.aiSuggestion?.generatedAt ?? null) !== input.expectedSuggestionAt
        )
          return apiJSON(
            { error: "The suggestion changed. Refresh and review it again." },
            { status: 409 },
          );
        if (input.decision === "approved") {
          for (const [key, table] of [
            [input.ruleKey, whtRules],
            [input.stRuleKey, stWhtRules],
          ] as const) {
            if (
              key &&
              !(
                await db
                  .select({ key: table.ruleKey })
                  .from(table)
                  .where(and(eq(table.ruleKey, key), eq(table.active, true)))
                  .limit(1)
              ).length
            )
              return apiJSON(
                { error: "Choose an active rule." },
                { status: 400 },
              );
          }
        }
        let assessment;
        try {
          assessment =
            input.decision === "approved"
              ? validateTaxAssessment(
                  input.taxAssessment,
                  input.ruleKey,
                  input.stRuleKey,
                  txn.txnDate,
                )
              : null;
        } catch (error) {
          return apiJSON(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Invalid tax assessment.",
            },
            { status: 400 },
          );
        }
        const ruleKey = input.decision === "excluded" ? null : input.ruleKey;
        const stRuleKey =
          input.decision === "excluded" ? null : input.stRuleKey;
        const memoryUpdates =
          input.rememberVendor && txn.vendorId && ruleKey
            ? [
                db
                  .update(vendors)
                  .set({ preferredRule: ruleKey, preferredStRule: stRuleKey })
                  .where(
                    and(
                      eq(vendors.id, txn.vendorId),
                      eq(vendors.companyId, companyId),
                    ),
                  ),
              ]
            : [];
        const result = await db.batch([
          db
            .update(glTransactions)
            .set({
              autoTag: ruleKey,
              stWhtTag: stRuleKey,
              reviewStatus: input.decision,
              taxAssessment: assessment,
              reviewNote: input.note,
              reviewedBy: session.user!.id!,
              reviewedAt: new Date(),
              tagSource:
                txn.aiSuggestion?.ruleKey === ruleKey && ruleKey
                  ? "ai_approved"
                  : "manual",
              tagConfidence: ruleKey ? "1.00" : "0",
            })
            .where(
              and(
                eq(glTransactions.id, txn.id),
                eq(glTransactions.reviewStatus, "pending"),
              ),
            )
            .returning({ id: glTransactions.id }),
          db.insert(auditLogs).values({
            companyId,
            actorId: session.user!.id!,
            action: "REVIEW_TRANSACTION",
            entityType: "gl_transaction",
            entityId: txn.id,
            payload: {
              ...input,
              model: txn.aiSuggestion?.model,
              previousTag: txn.autoTag,
            },
          }),
          ...memoryUpdates,
        ]);
        if (!result[0].length)
          return apiJSON(
            { error: "Entry was reviewed in another session. Refresh." },
            { status: 409 },
          );
        return apiJSON({ ok: true });
      } catch (error) {
        return apiJSON(
          {
            error:
              error instanceof z.ZodError
                ? "Choose a decision and add a review note."
                : error instanceof Error
                  ? error.message
                  : "Could not save review.",
          },
          { status: 400 },
        );
      }
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
