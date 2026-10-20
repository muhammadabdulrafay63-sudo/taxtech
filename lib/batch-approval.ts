import { db } from "@/db";
import { sql } from "drizzle-orm";
import { calculationInputsQuery } from "./calculation-inputs";

/** Called under the company write lock, after permission/evidence checks. */
export async function commitBatchApproval(
  batch: { id: string; companyId: string; year: number; month: number },
  actorId: string,
  kind: "income" | "sales",
) {
  const table = kind === "income" ? sql`wht_batches` : sql`st_wht_batches`;
  const entityType = kind === "income" ? "wht_batch" : "st_wht_batch";
  const action = kind === "income" ? "APPROVE_BATCH" : "APPROVE_ST_WHT_BATCH";
  const approvedFields =
    kind === "income"
      ? sql`, approved_by=${actorId}::uuid, approved_at=clock_timestamp()`
      : sql``;
  const payload =
    kind === "income"
      ? sql`jsonb_build_object('year',year,'month',month,'totalWht',total_wht::text)`
      : sql`jsonb_build_object('authority',authority,'year',year,'month',month)`;
  const inputs = calculationInputsQuery(
    batch.companyId,
    batch.year,
    batch.month,
    kind,
  );

  // SHARE allows concurrent approvals, but blocks INSERT/UPDATE/DELETE of global
  // rules, including edits outside the admin API. Locks live until transaction
  // commit/rollback, not in a process-local or expiring lease. READ COMMITTED
  // takes a fresh snapshot for the following statement after any waiting edit.
  const [, result] = await db.batch([
    db.execute(sql`LOCK TABLE wht_rules, st_wht_rules IN SHARE MODE`),
    db.execute(sql`WITH approved AS (
      UPDATE ${table} b SET status='approved' ${approvedFields}
      WHERE b.id=${batch.id}::uuid AND b.company_id=${batch.companyId}::uuid
        AND b.status='draft'
        AND NOT EXISTS (SELECT 1 FROM audit_logs a
          WHERE a.created_at > b.created_at
            AND a.action IN ('EDIT_WHT_RULE','EDIT_ST_WHT_RULE'))
        AND (SELECT a.payload->>'hash' FROM audit_logs a
          WHERE a.company_id=b.company_id AND a.entity_id=b.id::text
            AND a.entity_type=${entityType} AND a.action='CALCULATION_INPUTS'
            AND a.payload->>'version'='1'
          ORDER BY a.created_at DESC LIMIT 1)
          = encode(sha256(convert_to((${inputs}), 'UTF8')), 'hex')
      RETURNING *
    ) INSERT INTO audit_logs(company_id,actor_id,action,entity_type,entity_id,payload)
      SELECT company_id,${actorId}::uuid,${action},${entityType},id::text,${payload}
      FROM approved RETURNING entity_id`),
  ]);
  // A stale draft changes neither status nor audit history. An audit failure
  // rolls back the approval too, since both statements share one transaction.
  return result.rows.length === 1;
}
