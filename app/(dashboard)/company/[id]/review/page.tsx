import { incomePolicies, salesPolicies } from "@/lib/ty2025";
import { requireCompany } from "@/lib/page-access";
import { db } from "@/db";
import {
  glTransactions,
  whtRules,
  stWhtRules,
  whtBatches,
  vendors,
} from "@/db/schema";
import { and, eq, sql, asc } from "drizzle-orm";
import { LedgerReview } from "@/components/transactions/LedgerReview";
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; page?: string }>;
}) {
  const { id: companyId } = await params;
  await requireCompany(companyId);
  const sp = await searchParams;
  const months = await db
    .selectDistinct({
      period: sql<string>`to_char(${glTransactions.txnDate}::date, 'YYYY-MM')`,
    })
    .from(glTransactions)
    .where(eq(glTransactions.companyId, companyId));
  const periods = months
    .map((m) => m.period)
    .sort()
    .reverse();
  const period =
    sp.period && periods.includes(sp.period) ? sp.period : (periods[0] ?? "");
  const page = Math.max(1, Number.parseInt(sp.page ?? "1") || 1);
  const size = 20;
  const condition = and(
    eq(glTransactions.companyId, companyId),
    sql`to_char(${glTransactions.txnDate}::date, 'YYYY-MM') = ${period}`,
  );
  const [rows, counts, rules, stRules, batches, vendorOptions] =
    await Promise.all([
      db
        .select()
        .from(glTransactions)
        .where(condition)
        .orderBy(
          sql`case when ${glTransactions.reviewStatus}='pending' then 0 else 1 end`,
          asc(glTransactions.txnDate),
          asc(glTransactions.id),
        )
        .limit(size)
        .offset((page - 1) * size),
      db
        .select({
          total: sql<number>`count(*)`,
          pending: sql<number>`count(*) filter (where review_status='pending')`,
          approved: sql<number>`count(*) filter (where review_status='approved')`,
          excluded: sql<number>`count(*) filter (where review_status='excluded')`,
        })
        .from(glTransactions)
        .where(condition),
      db
        .select({
          ruleKey: whtRules.ruleKey,
          description: whtRules.description,
          section: whtRules.section,
        })
        .from(whtRules)
        .where(eq(whtRules.active, true)),
      db
        .select({
          ruleKey: stWhtRules.ruleKey,
          description: stWhtRules.description,
          authority: stWhtRules.authority,
        })
        .from(stWhtRules)
        .where(eq(stWhtRules.active, true)),
      db
        .select({ id: whtBatches.id, status: whtBatches.status })
        .from(whtBatches)
        .where(
          and(
            eq(whtBatches.companyId, companyId),
            eq(whtBatches.year, Number(period.slice(0, 4)) || 2000),
            eq(whtBatches.month, Number(period.slice(5, 7)) || 1),
          ),
        )
        .limit(1),
      db
        .select({
          id: vendors.id,
          name: vendors.name,
          recipientType: vendors.recipientType,
          isFiler: vendors.isFiler,
        })
        .from(vendors)
        .where(eq(vendors.companyId, companyId))
        .orderBy(vendors.name),
    ]);
  return (
    <LedgerReview
      vendors={vendorOptions}
      companyId={companyId}
      period={period}
      periods={periods}
      page={page}
      totalPages={Math.ceil(Number(counts[0].total) / size)}
      counts={{
        total: Number(counts[0].total),
        pending: Number(counts[0].pending),
        approved: Number(counts[0].approved),
        excluded: Number(counts[0].excluded),
      }}
      rows={rows.map((t) => ({
        ...t,
        reviewedAt: t.reviewedAt?.toISOString() ?? null,
        createdAt: undefined,
      }))}
      rules={rules.filter((r) => r.ruleKey in incomePolicies)}
      stRules={stRules.filter((r) => r.ruleKey in salesPolicies)}
      batch={batches[0] ?? null}
      aiAvailable={!!process.env.NEBIUS_API_KEY}
    />
  );
}
