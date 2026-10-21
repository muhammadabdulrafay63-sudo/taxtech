/** Opt-in migration + engine regression in an isolated TY2025 test database only. */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyTY2025Configuration } from "../scripts/ty2025-config";
import { TAX_POLICY_VERSION, salesPolicies } from "../lib/ty2025";
dotenv.config({
  path: process.env.TAXTECH_ENV_FILE || ".backups/ty2025-test.env",
  quiet: true,
});
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!url.pathname.startsWith("/taxtech_ty2025_"))
    throw new Error("Use an isolated TY2025 test database.");
  const sql = neon(url.toString());
  const company = randomUUID(),
    vendor = randomUUID(),
    locked = randomUUID(),
    draft = randomUUID(),
    approvedBatch = randomUUID();
  await sql.transaction([
    sql`INSERT INTO companies(id,name) VALUES (${company},'TY2025 migration regression')`,
    sql`INSERT INTO vendors(id,company_id,name,recipient_type,recipient_type_verified_at,is_filer,is_st_registered) VALUES (${vendor},${company},'Synthetic company','company',now(),true,true)`,
    sql`INSERT INTO wht_rules(rule_key,section,description,recipient_type,rate_filer,rate_non_filer) VALUES ('153_goods_company','153','Legacy 4%','company',4,8) ON CONFLICT(rule_key) DO UPDATE SET rate_filer=4,rate_non_filer=8`,
    sql`INSERT INTO st_wht_rules(rule_key,authority,province,category,description,st_rate,wht_factor,applies_to) VALUES ('srb_services_general','SRB','Sindh','services','Legacy 13%',13,1,'all') ON CONFLICT(rule_key) DO NOTHING`,
    sql`INSERT INTO gl_transactions(id,company_id,txn_date,description,debit,credit,amount,vendor_id,auto_tag,review_status,review_note,reviewed_at) VALUES (${locked},${company},'2024-07-01','Locked historical fixture',100000,0,100000,${vendor},'153_goods_company','approved','Original decision',now()),(${draft},${company},'2025-06-01','Legacy unconfirmed fixture',100000,0,100000,${vendor},'153_goods_company','approved','Retain audit evidence',now())`,
    sql`INSERT INTO wht_batches(id,company_id,year,month,status,total_gross,total_wht) VALUES (${approvedBatch},${company},2024,7,'approved',100000,4000)`,
    sql`INSERT INTO wht_lines(company_id,gl_txn_id,vendor_id,rule_id,period_year,period_month,gross_amount,wht_rate,wht_amount,tax_status) SELECT ${company},${locked},${vendor},id,2024,7,100000,4,4000,'filer' FROM wht_rules WHERE rule_key='153_goods_company'`,
  ]);
  await applyTY2025Configuration(sql);
  await applyTY2025Configuration(sql);
  const [historical] =
    await sql`SELECT wht_amount::text,wht_rate::text FROM wht_lines WHERE gl_txn_id=${locked}`;
  assert.equal(historical.wht_amount, "4000.00");
  assert.equal(historical.wht_rate, "4.000");
  const rows =
    await sql`SELECT id,review_status FROM gl_transactions WHERE company_id=${company}`;
  assert.equal(rows.find((r) => r.id === locked)?.review_status, "approved");
  assert.equal(rows.find((r) => r.id === draft)?.review_status, "pending");
  const [legacy] =
    await sql`SELECT active FROM st_wht_rules WHERE rule_key='srb_services_general'`;
  assert.equal(legacy.active, false);
  const [incomeRule] =
    await sql`SELECT rate_filer::text,rate_non_filer::text FROM wht_rules WHERE rule_key='153_goods_company'`;
  assert.equal(incomeRule.rate_filer, "5.000");
  assert.equal(incomeRule.rate_non_filer, "10.000");
  const { calculateWHT } = await import("../lib/whtEngine");
  const { calculateSTWHT } = await import("../lib/stWHTEngine");
  const txn = randomUUID();
  const a = {
    version: TAX_POLICY_VERSION,
    eligibilityConfirmed: true,
    incomeGross: "118000.00",
    salesBase: "100000.00",
    salesTax: "18000.00",
  };
  await sql`INSERT INTO gl_transactions(id,company_id,txn_date,description,debit,credit,amount,vendor_id,auto_tag,review_status,tax_assessment) VALUES (${txn},${company},'2025-05-01','Synthetic tax-inclusive invoice',100000,0,100000,${vendor},'153_goods_company','approved',${JSON.stringify(a)}::jsonb)`;
  const result = await calculateWHT(company, 2025, 5);
  assert.equal(result.totalGross, "118000.00");
  assert.equal(result.totalWht, "5900.00");
  const again = await calculateWHT(company, 2025, 5);
  assert.equal(again.totalWht, "5900.00");
  const [count] =
    await sql`SELECT count(*)::int n FROM wht_batches WHERE company_id=${company} AND month=5`;
  assert.equal(count.n, 1);
  await sql`UPDATE gl_transactions SET tax_assessment=null WHERE id=${txn}`;
  await assert.rejects(() => calculateWHT(company, 2025, 5), /Confirm invoice/);
  const [preserved] =
    await sql`SELECT total_wht::text FROM wht_batches WHERE company_id=${company} AND month=5`;
  assert.equal(preserved.total_wht, "5900.00");
  await sql`UPDATE gl_transactions SET tax_assessment=${JSON.stringify(a)}::jsonb WHERE id=${txn}`;
  const expected: Record<string, string> = {
    ty25_fbr_active_unregistered_buyer: "3600.00",
    ty25_fbr_active_registered_buyer: "0.00",
    ty25_srb_standard: "3000.00",
    ty25_srb_public: "12000.00",
    ty25_pra_registered_noncompany: "16000.00",
    ty25_pra_active_company: "0.00",
    ty25_kpra_standard: "7500.00",
    ty25_bra_standard: "3000.00",
  };
  for (const [key, p] of Object.entries(salesPolicies)) {
    const id = randomUUID(),
      v = randomUUID();
    const type =
      key === "ty25_pra_registered_noncompany" ? "individual_aop" : "company";
    await sql`INSERT INTO vendors(id,company_id,name,recipient_type,recipient_type_verified_at,is_filer,is_st_registered) VALUES (${v},${company},${"Synthetic " + key},${type},now(),true,true)`;
    const assessment = {
      version: TAX_POLICY_VERSION,
      eligibilityConfirmed: true,
      salesBase: "100000.00",
      salesTax: String(Number(p.stRate) * 1000),
    };
    await sql`INSERT INTO gl_transactions(id,company_id,txn_date,description,debit,credit,amount,vendor_id,st_wht_tag,review_status,tax_assessment) VALUES (${id},${company},'2025-05-02',${"Synthetic " + key},100000,0,100000,${v},${key},'approved',${JSON.stringify(assessment)}::jsonb)`;
  }
  const st = await calculateSTWHT(company, 2025, 5);
  assert.equal(st.linesCreated, 8);
  assert.equal(Object.keys(st.batches).length, 5);
  const lines =
    await sql`SELECT r.rule_key,l.wht_amount::text FROM st_wht_lines l JOIN st_wht_rules r ON r.id=l.rule_id WHERE l.company_id=${company} AND l.period_month=5`;
  for (const l of lines)
    assert.equal(l.wht_amount, expected[l.rule_key], l.rule_key);
  await calculateSTWHT(company, 2025, 5);
  const [stCount] =
    await sql`SELECT count(*)::int n FROM st_wht_batches WHERE company_id=${company} AND month=5`;
  assert.equal(stCount.n, 5);
  await sql`UPDATE vendors SET is_st_registered=false WHERE company_id=${company}`;
  await assert.rejects(
    () => calculateSTWHT(company, 2025, 5),
    /registered supplier/,
  );
  await assert.rejects(() => calculateWHT(company, 2024, 7), /locked|approved/);
  console.log(
    JSON.stringify({
      migrationRepeatable: true,
      approvedHistoryUnchanged: true,
      legacyReviewReopened: true,
      grossIncludingTax: "118000.00",
      incomeWithholding: "5900.00",
      salesCases: 8,
      authorities: 5,
      draftPreservedOnFailure: true,
      unsupportedStatusBlocked: true,
    }),
  );
}
main().catch((e) => {
  console.error(
    "TY2025 regression failed:",
    String(e.message).replace(
      /postgres(?:ql)?:\/\/[^\s]+/gi,
      "[connection redacted]",
    ),
  );
  process.exitCode = 1;
});
