import { createHash } from "node:crypto";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { sql, and, eq, desc } from "drizzle-orm";

/** Shared SQL keeps application and commit-time fingerprints identical. */
export function calculationInputsQuery(
  companyId: string,
  year: number,
  month: number,
  kind: "income" | "sales",
) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const rules = kind === "income" ? sql`wht_rules` : sql`st_wht_rules`;
  return sql`SELECT jsonb_build_object(
    'transactions', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) FROM gl_transactions t WHERE t.company_id=${companyId}::uuid AND t.txn_date >= ${start}::date AND t.txn_date < ${end}::date),
    'vendors', (SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.id),'[]'::jsonb) FROM vendors v WHERE v.company_id=${companyId}::uuid AND EXISTS(SELECT 1 FROM gl_transactions t WHERE t.company_id=${companyId}::uuid AND t.vendor_id=v.id AND t.txn_date >= ${start}::date AND t.txn_date < ${end}::date)),
    'rules', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM ${rules} r)
  )::text AS inputs`;
}

/** One database snapshot of inputs. Independent of whether mutation audit events exist. */
export async function calculationInputHash(
  companyId: string,
  year: number,
  month: number,
  kind: "income" | "sales",
) {
  const result = await db.execute<{ inputs: string }>(
    calculationInputsQuery(companyId, year, month, kind),
  );
  if (!result.rows[0]?.inputs)
    throw new Error("Could not verify calculation inputs.");
  return createHash("sha256").update(result.rows[0].inputs).digest("hex");
}

export function recordCalculationInputs(
  companyId: string,
  batchId: string,
  kind: "income" | "sales",
  hash: string,
) {
  return db.insert(auditLogs).values({
    companyId,
    action: "CALCULATION_INPUTS",
    entityType: kind === "income" ? "wht_batch" : "st_wht_batch",
    entityId: batchId,
    payload: { version: 1, hash },
  });
}

export async function calculationInputsMatch(
  companyId: string,
  batchId: string,
  year: number,
  month: number,
  kind: "income" | "sales",
) {
  const [saved] = await db
    .select({ payload: auditLogs.payload })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.companyId, companyId),
        eq(auditLogs.entityId, batchId),
        eq(
          auditLogs.entityType,
          kind === "income" ? "wht_batch" : "st_wht_batch",
        ),
        eq(auditLogs.action, "CALCULATION_INPUTS"),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  const snapshot = saved?.payload as
    | { version?: number; hash?: string }
    | undefined;
  return (
    snapshot?.version === 1 &&
    snapshot.hash === (await calculationInputHash(companyId, year, month, kind))
  );
}
