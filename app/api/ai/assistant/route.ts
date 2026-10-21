import { guardRoute } from "@/lib/route-guard";
import { auth } from "@/auth";
import { db } from "@/db";
import { glTransactions, whtBatches } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { apiJSON } from "@/lib/api-response";
import { z } from "zod";
import { completeJSON, AIError } from "@/lib/ai/nebius";
import { claimAIRequest } from "@/lib/ai/limit";
import {
  guide,
  currentGuide,
  assistantSchemaDescription,
} from "@/lib/ai/guide";
const body = z.object({
  pathname: z.string().max(300),
  question: z.string().trim().min(1).max(1200),
  context: z.string().max(500).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(6)
    .default([]),
});
const output = z.object({
  answer: z.string().min(1).max(3000),
  pageKeys: z.array(z.string()).max(3),
});
export const maxDuration = 60;
export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user?.id)
    return apiJSON({ error: "Please sign in." }, { status: 401 });
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId)
    return apiJSON(
      { error: "No company assigned." },
      { status: 403 },
    );
  try {
    const input = body.parse(await req.json());
    const [counts, batches] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          pending: sql<number>`count(*) filter (where review_status='pending')`,
        })
        .from(glTransactions)
        .where(eq(glTransactions.companyId, companyId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(whtBatches)
        .where(
          and(
            eq(whtBatches.companyId, companyId),
            eq(whtBatches.status, "draft"),
          ),
        ),
    ]);
    await claimAIRequest(companyId, session.user.id, "assistant");
    const response = await completeJSON(
      assistantSchemaDescription,
      {
        screen: currentGuide(input.pathname).title,
        question: input.question,
        context: input.context,
        history: input.history,
        guide,
        companySummary: { ...counts[0], draftBatches: batches[0].count },
      },
      output,
    );
    const links = response.result.pageKeys.flatMap((key) => {
      const page = guide.find((g) => g.key === key);
      return page
        ? [
            {
              label: page.title,
              href:
                page.key === "dashboard"
                  ? "/dashboard"
                  : `/company/${companyId}${page.suffix}`,
            },
          ]
        : [];
    });
    return apiJSON({
      answer: response.result.answer,
      links,
      model: response.model,
    });
  } catch (error) {
    return apiJSON(
      {
        error:
          error instanceof AIError
            ? error.message
            : "Unable to answer right now. The page guide below is still available.",
      },
      { status: error instanceof AIError ? error.status : 400 },
    );
  }
}
