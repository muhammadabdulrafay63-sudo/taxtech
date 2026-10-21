/** Explicit one-time provisioning of invented demo data. Never an automatic production seed. */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { judgeFixture as f, judgeExamples } from "../lib/judge-fixture";
dotenv.config({
  path: process.env.TAXTECH_ENV_FILE || ".env.local",
  quiet: true,
});
async function main() {
  if (process.env.CONFIRM_JUDGE_DEMO_PROVISION !== "synthetic-only")
    throw new Error(
      "Explicit synthetic-only provisioning confirmation required.",
    );
  const password = process.env.JUDGE_DEMO_PASSWORD;
  if (!password || password.length < 24)
    throw new Error(
      "Supply a private, random judge password of at least 24 characters.",
    );
  const sql = neon(process.env.DATABASE_URL!);
  const email = "judge-taxtech@example.invalid";
  const existing =
    await sql`SELECT id,company_id,password_hash,role FROM users WHERE id=${f.userId} OR email=${email}`;
  if (
    existing.length &&
    (existing.length !== 1 ||
      existing[0].id !== f.userId ||
      existing[0].company_id !== f.companyId ||
      existing[0].role !== "accountant" ||
      !(await bcrypt.compare(password, existing[0].password_hash)))
  )
    throw new Error(
      "Existing account differs; no password or ownership was changed.",
    );
  const hash = existing[0]?.password_hash || (await bcrypt.hash(password, 12));
  await sql.transaction([
    sql`INSERT INTO companies(id,name) VALUES (${f.companyId},${f.companyName}) ON CONFLICT(id) DO NOTHING`,
    sql`INSERT INTO users(id,name,email,password_hash,role,company_id) VALUES (${f.userId},'Hackathon Judge',${email},${hash},'accountant',${f.companyId}) ON CONFLICT(id) DO NOTHING`,
    sql`INSERT INTO vendors(id,company_id,name,recipient_type,recipient_type_verified_at,is_filer,is_st_registered,province,notes) VALUES (${f.goodsVendorId},${f.companyId},'Demo Stationery','company',now(),true,true,'National','Entirely synthetic resident-company and historical active-status assumptions. No actual ATL verification; ordinary 18% goods invoice. Buyer is assumed an eligible company not ST-registered.'),(${f.servicesVendorId},${f.companyId},'Demo Assurance','company',now(),true,true,'Sindh','Entirely synthetic status and jurisdiction assumptions. Statutory audit fee (not specified 4% services). Registered active resident company; ordinary 15% SRB service to eligible private company withholding agent; no exclusion/exemption.') ON CONFLICT(id) DO NOTHING`,
    ...[f.preparedPeriod, f.practicePeriod].flatMap((period) =>
      judgeExamples.map(
        (row) =>
          sql`INSERT INTO gl_transactions(company_id,source_file,txn_date,description,account_code,debit,credit,amount,vendor_id,review_status,tag_confidence) SELECT ${f.companyId},'Synthetic preloaded demo',${period + "-" + row.day}::date,${row.description},${row.accountCode},${row.amount}::numeric,0,${row.amount}::numeric,${row.vendorId}::uuid,'pending',0 WHERE NOT EXISTS(SELECT 1 FROM gl_transactions WHERE company_id=${f.companyId} AND txn_date=${period + "-" + row.day}::date AND account_code=${row.accountCode})`,
      ),
    ),
    sql`INSERT INTO audit_logs(company_id,actor_id,action,entity_type,entity_id,payload) SELECT ${f.companyId},${f.userId},'PROVISION_JUDGE_DEMO','synthetic_demo',${f.userId},${JSON.stringify({ credentialFingerprint: createHash("sha256").update(hash).digest("hex"), syntheticOnly: true, preparedPeriod: f.preparedPeriod, practicePeriod: f.practicePeriod })}::jsonb WHERE NOT EXISTS(SELECT 1 FROM audit_logs WHERE action='PROVISION_JUDGE_DEMO' AND entity_id=${f.userId})`,
  ]);
  console.log(
    JSON.stringify({
      judgeAccountProvisioned: true,
      role: "accountant",
      syntheticOnly: true,
      periods: [f.preparedPeriod, f.practicePeriod],
      credentialsPrinted: false,
    }),
  );
}
main().catch(() => {
  console.error(
    "Judge provisioning failed. Inspect the private account details and database setup; no credentials were printed.",
  );
  process.exitCode = 1;
});
