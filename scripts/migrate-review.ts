import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
dotenv.config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  await sql.transaction([
    sql`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS recipient_type_verified_at timestamp`,
    sql`CREATE INDEX IF NOT EXISTS gl_company_date_idx ON gl_transactions(company_id,txn_date)`,
    sql`CREATE INDEX IF NOT EXISTS audit_company_time_idx ON audit_logs(company_id,created_at)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS wht_company_period_unique ON wht_batches(company_id,year,month)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS st_company_period_authority_unique ON st_wht_batches(company_id,year,month,authority)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS challan_batch_section_unique ON challan_records(batch_id,section)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS secp_company_unique ON secp_companies(company_id)`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1`,
    sql`ALTER TABLE gl_transactions ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending', ADD COLUMN IF NOT EXISTS review_note text, ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id), ADD COLUMN IF NOT EXISTS reviewed_at timestamp, ADD COLUMN IF NOT EXISTS ai_suggestion jsonb`,
    sql`CREATE INDEX IF NOT EXISTS gl_company_review_idx ON gl_transactions(company_id,review_status)`,
    sql`CREATE TABLE IF NOT EXISTS workflow_locks (company_id uuid PRIMARY KEY REFERENCES companies(id), token text NOT NULL, expires_at timestamptz NOT NULL)`,
    sql`CREATE TABLE IF NOT EXISTS ledger_imports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), fingerprint text NOT NULL, created_at timestamp DEFAULT now(), UNIQUE(company_id,fingerprint))`,
    sql`CREATE TABLE IF NOT EXISTS ai_request_limits (bucket text PRIMARY KEY, used integer NOT NULL DEFAULT 0)`,
    sql`ALTER TABLE secp_companies ADD COLUMN IF NOT EXISTS officer_count integer`,
    sql`ALTER TABLE secp_obligations ADD COLUMN IF NOT EXISTS period_year integer, ADD COLUMN IF NOT EXISTS provisional boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'legacy'`,
  ]);
  console.log(
    "Review schema ready. Existing transactions remain pending; no financial records were removed.",
  );
}
main().catch(() => {
  console.error(
    "Migration failed. Check database connectivity and existing schema.",
  );
  process.exit(1);
});
