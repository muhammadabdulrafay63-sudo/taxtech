import { db } from "@/db";
import { sql } from "drizzle-orm";
import { judgeFixture, judgeExamples } from "./judge-fixture";
/** Call only under the dedicated judge company's write lease. March is never touched. */
export async function resetJudgePractice() {
  const c = judgeFixture.companyId;
  const [identity] = await db
    .execute<{
      ready: boolean;
    }>(sql`SELECT EXISTS(SELECT 1 FROM companies c JOIN users u ON u.company_id=c.id WHERE c.id=${c}::uuid AND c.name=${judgeFixture.companyName} AND u.id=${judgeFixture.userId}::uuid AND u.role='accountant') AS ready`)
    .then((r) => r.rows);
  if (!identity?.ready)
    throw new Error("The synthetic judge workspace could not be verified.");
  await db.batch([
    db.execute(
      sql`DELETE FROM wht_batches WHERE company_id=${c}::uuid AND year=2025 AND month=4`,
    ),
    db.execute(
      sql`DELETE FROM st_wht_batches WHERE company_id=${c}::uuid AND year=2025 AND month=4`,
    ),
    db.execute(
      sql`DELETE FROM wht_lines WHERE company_id=${c}::uuid AND period_year=2025 AND period_month=4`,
    ),
    db.execute(
      sql`DELETE FROM st_wht_lines WHERE company_id=${c}::uuid AND period_year=2025 AND period_month=4`,
    ),
    db.execute(
      sql`DELETE FROM gl_transactions WHERE company_id=${c}::uuid AND txn_date >= '2025-04-01' AND txn_date < '2025-05-01'`,
    ),
    ...judgeExamples.map((row) =>
      db.execute(
        sql`INSERT INTO gl_transactions(company_id,source_file,txn_date,description,account_code,debit,credit,amount,vendor_id,review_status,tag_confidence) VALUES (${c}::uuid,'Synthetic preloaded practice',${judgeFixture.practicePeriod + "-" + row.day}::date,${row.description},${row.accountCode},${row.amount}::numeric,0,${row.amount}::numeric,${row.vendorId}::uuid,'pending',0)`,
      ),
    ),
    db.execute(
      sql`INSERT INTO audit_logs(company_id,actor_id,action,entity_type,payload) VALUES (${c}::uuid,${judgeFixture.userId}::uuid,'RESET_JUDGE_PRACTICE','synthetic_demo',jsonb_build_object('period','2025-04','preparedExamplePreserved',true))`,
    ),
  ]);
}
export async function judgeDemoHealth() {
  const result = await db.execute<{
    available: boolean;
    prepared_ready: boolean;
  }>(sql`SELECT
    EXISTS(SELECT 1 FROM users u JOIN companies c ON c.id=u.company_id
      WHERE u.id=${judgeFixture.userId}::uuid AND c.id=${judgeFixture.companyId}::uuid AND c.name=${judgeFixture.companyName} AND u.role='accountant'
      AND EXISTS(SELECT 1 FROM audit_logs a WHERE a.entity_id=u.id::text AND a.action='PROVISION_JUDGE_DEMO' AND a.payload->>'credentialFingerprint'=encode(sha256(convert_to(u.password_hash,'UTF8')),'hex'))) AS available,
    EXISTS(SELECT 1 FROM wht_batches WHERE company_id=${judgeFixture.companyId}::uuid AND year=2025 AND month=3 AND status IN ('approved','paid') AND total_wht=16250) AS prepared_ready`);
  return result.rows[0];
}
