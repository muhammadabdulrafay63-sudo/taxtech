import { db } from "@/db";
import { glTransactions, whtBatches, stWhtBatches } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { isSupportedTaxPeriod } from "./tax-policy";
import { calculationInputsMatch } from "./calculation-inputs";
export class WorkflowError extends Error {}
export function assertSupportedTaxPeriod(year: number, month: number) {
  if (!isSupportedTaxPeriod(year, month))
    throw new WorkflowError(
      "No source schedule supports this period. The supplied schedules support July 2024 through June 2025 only. Obtain reviewed schedules before calculating or approving other periods.",
    );
}
export async function assertPeriodEditable(
  companyId: string,
  year: number,
  month: number,
) {
  const [income, sales] = await Promise.all([
    db
      .select({ id: whtBatches.id })
      .from(whtBatches)
      .where(
        and(
          eq(whtBatches.companyId, companyId),
          eq(whtBatches.year, year),
          eq(whtBatches.month, month),
          ne(whtBatches.status, "draft"),
        ),
      )
      .limit(1),
    db
      .select({ id: stWhtBatches.id })
      .from(stWhtBatches)
      .where(
        and(
          eq(stWhtBatches.companyId, companyId),
          eq(stWhtBatches.year, year),
          eq(stWhtBatches.month, month),
          ne(stWhtBatches.status, "draft"),
        ),
      )
      .limit(1),
  ]);
  if (income.length || sales.length)
    throw new WorkflowError(
      "This period has an approved batch. Its transactions and calculations are locked.",
    );
}
export async function assertPeriodReviewed(
  companyId: string,
  year: number,
  month: number,
) {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const [pending] = await db
    .select({ count: sql<number>`count(*)` })
    .from(glTransactions)
    .where(
      and(
        eq(glTransactions.companyId, companyId),
        eq(glTransactions.reviewStatus, "pending"),
        sql`to_char(${glTransactions.txnDate}::date, 'YYYY-MM') = ${prefix}`,
      ),
    );
  if (Number(pending.count))
    throw new WorkflowError(
      `Review or exclude all ${pending.count} pending transactions for this month before generating a batch.`,
    );
  const broken = await db.execute(sql`SELECT 1 FROM gl_transactions
    WHERE company_id=${companyId}::uuid
      AND to_char(txn_date::date,'YYYY-MM')=${prefix}
      AND review_status <> 'excluded'
      AND (debit IS NULL OR credit IS NULL OR amount <> debit-credit)
    LIMIT 1`);
  if (broken.rows.length)
    throw new WorkflowError(
      "A ledger entry has inconsistent debit, credit and net amounts. Reconcile it against the source and reimport before calculating or approving this period.",
    );
}

// Serialize company writes across processes so review, import and approval cannot race.
// A lease recovers automatically after a crashed request; all external AI calls time out at 45s.
export async function withCompanyWrite<T>(
  companyId: string,
  run: () => Promise<T>,
): Promise<T> {
  const token = crypto.randomUUID();
  const lock =
    await db.execute(sql`INSERT INTO workflow_locks (company_id, token, expires_at) VALUES (${companyId}::uuid, ${token}, now() + interval '5 minutes')
    ON CONFLICT (company_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at WHERE workflow_locks.expires_at < now() RETURNING token`);
  if (!lock.rows.length)
    throw new WorkflowError(
      "Another change is in progress for this company. Please try again shortly.",
    );
  try {
    return await run();
  } finally {
    await db.execute(
      sql`DELETE FROM workflow_locks WHERE company_id=${companyId}::uuid AND token=${token}`,
    );
  }
}

export async function assertBatchFresh(
  companyId: string,
  year: number,
  month: number,
  createdAt: Date | null,
  batchId: string,
  kind: "income" | "sales",
) {
  assertSupportedTaxPeriod(year, month);
  await assertPeriodReviewed(companyId, year, month);
  if (!createdAt)
    throw new WorkflowError("Regenerate this draft before approval.");
  const changed =
    await db.execute(sql`SELECT 1 FROM audit_logs WHERE created_at > ${createdAt.toISOString()}::timestamp AND
    ((company_id = ${companyId}::uuid AND action IN ('IMPORT_LEDGER','REVIEW_TRANSACTION','OVERRIDE_TAG','UPDATE_ST_WHT_TAG','UPDATE_VENDOR','ASSIGN_VENDOR'))
      OR action IN ('EDIT_WHT_RULE','EDIT_ST_WHT_RULE')) LIMIT 1`);
  if (changed.rows.length)
    throw new WorkflowError(
      "Records or rules changed since calculation. Recalculate this draft before approval.",
    );
  if (!(await calculationInputsMatch(companyId, batchId, year, month, kind)))
    throw new WorkflowError(
      "Calculation inputs changed or this legacy draft lacks a verified snapshot. Recalculate before approval.",
    );
}

export async function assertCalculationEditable(
  companyId: string,
  year: number,
  month: number,
  kind: "income" | "sales",
) {
  assertSupportedTaxPeriod(year, month);
  const table = kind === "income" ? whtBatches : stWhtBatches;
  const [locked] = await db
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        eq(table.companyId, companyId),
        eq(table.year, year),
        eq(table.month, month),
        ne(table.status, "draft"),
      ),
    )
    .limit(1);
  if (locked)
    throw new WorkflowError(
      "This tax batch is approved and cannot be recalculated.",
    );
}
