/** Regression: audit-write failures roll back, and missing audit events cannot certify stale inputs. Isolated install_* only. */
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
async function main() {
  const env = JSON.parse(await readFile("/tmp/taxtech-fresh-env.json", "utf8"));
  const url = new URL(env.DATABASE_URL);
  if (!/^install_[a-f0-9]+$/.test(url.pathname.slice(1)))
    throw Error("Only the isolated installation database may receive faults.");
  const sql = neon(env.DATABASE_URL),
    base = "http://localhost:3002";
  const companyId = randomUUID(),
    email = `fault-audit-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString("base64url"),
    hash = await bcrypt.hash(password, 12);
  await sql.transaction([
    sql`INSERT INTO companies(id,name,paid_up_capital) VALUES (${companyId},'Isolated audit failure fixture',250000)`,
    sql`INSERT INTO users(name,email,password_hash,role,company_id) VALUES ('Fault test',${email},${hash},'superadmin',${companyId})`,
  ]);
  const csrf = await fetch(base + "/api/auth/csrf"),
    { csrfToken } = await csrf.json();
  let cookie = csrf.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const login = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie,
      Origin: base,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ csrfToken, email, password }),
  });
  cookie +=
    "; " +
    login.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
  async function req(path: string, body?: unknown, method = "POST") {
    const r = await fetch(base + path, {
      method,
      headers: {
        cookie,
        Origin: base,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  }
  const session = await (
    await fetch(base + "/api/auth/session", { headers: { cookie } })
  ).json();
  assert.equal(session.user?.email, email);
  const clear = await req(
    `/api/company/${companyId}`,
    { paidUpCapital: null },
    "PATCH",
  );
  const [capital] =
    await sql`SELECT paid_up_capital FROM companies WHERE id=${companyId}`;
  assert.equal(clear.status, 200, JSON.stringify(clear));
  assert.equal(capital.paid_up_capital, null);
  assert.equal(
    (await req(`/api/company/${companyId}`, { paidUpCapital: 250000 }, "PATCH"))
      .status,
    200,
  );
  assert.equal(
    (
      await req(
        `/api/company/${companyId}`,
        { name: "Isolated audit failure fixture" },
        "PATCH",
      )
    ).status,
    200,
  );
  const [omitted] =
    await sql`SELECT paid_up_capital FROM companies WHERE id=${companyId}`;
  assert.equal(
    omitted.paid_up_capital,
    "250000.00",
    "Omitted capital remains unchanged",
  );
  const fullForm = await req(
    `/api/company/${companyId}`,
    { name: "Isolated audit failure fixture", paidUpCapital: null },
    "PATCH",
  );
  const [afterForm] =
    await sql`SELECT paid_up_capital FROM companies WHERE id=${companyId}`;
  assert.equal(fullForm.status, 200);
  assert.equal(afterForm.paid_up_capital, null);
  const settings = {
    case: "Clear optional company capital",
    response: clear,
    retained: capital.paid_up_capital,
    fullFormResponse: fullForm,
    retainedAfterForm: afterForm.paid_up_capital,
    safe: capital.paid_up_capital === null,
  };
  console.log(JSON.stringify(settings));
  const [vendor] =
    await sql`INSERT INTO vendors(company_id,name,recipient_type,recipient_type_verified_at,is_filer) VALUES (${companyId},'Synthetic verified supplier','company',now(),true) RETURNING id`;
  const [rule] =
    await sql`SELECT * FROM wht_rules WHERE rule_key='153_goods_company'`;
  const [txn] =
    await sql`INSERT INTO gl_transactions(company_id,txn_date,description,amount,debit,vendor_id,review_status) VALUES (${companyId},'2025-03-01','Synthetic fault test invoice',100000,100000,${vendor.id},'pending') RETURNING id`;
  assert.equal(
    (
      await req("/api/transactions/review", {
        id: txn.id,
        decision: "approved",
        ruleKey: rule.rule_key,
        stRuleKey: null,
        note: "Synthetic invoice and recipient evidence verified.",
      })
    ).status,
    200,
  );
  const calc = await req("/api/wht/calc", { companyId, year: 2025, month: 3 });
  assert.equal(calc.status, 200, JSON.stringify(calc));
  const [actor] = await sql`SELECT id FROM users WHERE email=${email}`;
  const fn = "audit_fault_" + randomUUID().replaceAll("-", "");
  let mutation: unknown;
  try {
    await sql.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_id = '${actor.id}'::uuid AND NEW.action IN ('UPDATE_VENDOR','CREATE_VENDOR','UPDATE_COMPANY','OVERRIDE_TAG','UPDATE_ST_WHT_TAG','EDIT_WHT_RULE','EDIT_ST_WHT_RULE') THEN RAISE EXCEPTION 'Synthetic isolated audit outage'; END IF; RETURN NEW; END $$`,
    );
    await sql.query(
      `CREATE TRIGGER ${fn} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
    );
    const change = await req(
      `/api/vendors/${vendor.id}`,
      { isFiler: false },
      "PATCH",
    );
    const [saved] =
      await sql`SELECT is_filer FROM vendors WHERE id=${vendor.id}`;
    const [audit] =
      await sql`SELECT count(*)::int n FROM audit_logs WHERE company_id=${companyId} AND action='UPDATE_VENDOR'`;
    assert.equal(
      change.status,
      500,
      "Injected audit outage reaches the client as failure",
    );
    assert.equal(
      saved.is_filer,
      true,
      "Vendor update must roll back when audit fails",
    );
    assert.equal(audit.n, 0);
    const tagChange = await req(
      `/api/transactions/${txn.id}/tag`,
      { ruleKey: null },
      "PATCH",
    );
    assert.equal(tagChange.status, 500);
    const stChange = await req(
      `/api/transactions/${txn.id}/st-tag`,
      { stWhtTag: "fbr_goods_registered" },
      "PATCH",
    );
    assert.equal(stChange.status, 500);
    const [kept] =
      await sql`SELECT auto_tag,st_wht_tag,review_status FROM gl_transactions WHERE id=${txn.id}`;
    assert.equal(kept.auto_tag, rule.rule_key);
    assert.equal(kept.st_wht_tag, null);
    assert.equal(kept.review_status, "approved");
    const ruleChange = await req(
      `/api/admin/rules/${rule.id}`,
      { rateFiler: Number(rule.rate_filer) === 7 ? 6 : 7 },
      "PATCH",
    );
    assert.equal(ruleChange.status, 500);
    const [keptRule] =
      await sql`SELECT rate_filer FROM wht_rules WHERE id=${rule.id}`;
    assert.equal(keptRule.rate_filer, rule.rate_filer);
    const [stRule] =
      await sql`SELECT id,st_rate FROM st_wht_rules WHERE rule_key='fbr_goods_registered'`;
    assert.ok(stRule);
    assert.equal(
      (
        await req(
          `/api/admin/st-rules/${stRule.id}`,
          { stRate: Number(stRule.st_rate) === 17 ? 16 : 17 },
          "PATCH",
        )
      ).status,
      500,
    );
    const [keptSt] =
      await sql`SELECT st_rate FROM st_wht_rules WHERE id=${stRule.id}`;
    assert.equal(keptSt.st_rate, stRule.st_rate);
    const createVendor = await req("/api/vendors", {
      companyId,
      name: "Rollback supplier",
      recipientType: "company",
      isFiler: true,
    });
    assert.equal(createVendor.status, 500, JSON.stringify(createVendor));
    const [createdCount] =
      await sql`SELECT count(*)::int n FROM vendors WHERE company_id=${companyId} AND name='Rollback supplier'`;
    assert.equal(createdCount.n, 0);
    assert.equal(
      (
        await req(
          `/api/company/${companyId}`,
          { paidUpCapital: 500000 },
          "PATCH",
        )
      ).status,
      500,
    );
    const [keptCompany] =
      await sql`SELECT paid_up_capital FROM companies WHERE id=${companyId}`;
    assert.equal(keptCompany.paid_up_capital, null);
    // Simulate a historical unaudited change, independently of the now-atomic route.
    await sql`UPDATE vendors SET is_filer=false WHERE id=${vendor.id}`;
    const approval = await req(`/api/wht/batch/${calc.data.batchId}/approve`);
    assert.equal(
      approval.status,
      409,
      "The input snapshot detects changes without an audit event",
    );
    assert.match(approval.data.error, /inputs changed|snapshot/);
    const [batch] =
      await sql`SELECT status,total_wht FROM wht_batches WHERE id=${calc.data.batchId}`;
    assert.equal(batch.status, "draft");
    mutation = {
      case: "Vendor change during audit-write outage",
      changeStatus: change.status,
      persistedFiler: saved.is_filer,
      auditRecords: audit.n,
      approvalStatus: approval.status,
      batch,
      expectedNonFilerTax: 1000 * Number(rule.rate_non_filer),
      safe: saved.is_filer === true && approval.status === 409,
      atomicMutationsVerified: [
        "vendor",
        "vendor creation",
        "company",
        "income tag",
        "sales tag",
        "income rule",
        "sales rule",
      ],
    };
    console.log(JSON.stringify(mutation));
  } finally {
    await sql.query(`DROP TRIGGER IF EXISTS ${fn} ON audit_logs`);
    await sql.query(`DROP FUNCTION IF EXISTS ${fn}()`);
  }
  // A legitimate recalculation with unchanged inputs must still approve.
  const revised = await req("/api/wht/calc", {
    companyId,
    year: 2025,
    month: 3,
  });
  assert.equal(revised.status, 200, JSON.stringify(revised));
  assert.equal(Number(revised.data.totalWht), 1000 * Number(rule.rate_non_filer));
  assert.equal(
    (await req(`/api/wht/batch/${revised.data.batchId}/approve`)).status,
    200,
  );
  // Sales approval uses its own independent snapshot too.
  const [salesTxn] =
    await sql`INSERT INTO gl_transactions(company_id,txn_date,description,amount,debit,vendor_id,review_status,st_wht_tag) VALUES (${companyId},'2025-04-01','Synthetic sales snapshot test',100000,100000,${vendor.id},'approved','fbr_goods_registered') RETURNING id`;
  assert.ok(salesTxn);
  await sql`UPDATE vendors SET is_st_registered=true WHERE id=${vendor.id}`;
  assert.equal(
    (await req("/api/st-wht/calc", { companyId, year: 2025, month: 4 })).status,
    200,
  );
  const [salesBatch] =
    await sql`SELECT id FROM st_wht_batches WHERE company_id=${companyId} AND year=2025 AND month=4`;
  await sql`UPDATE vendors SET is_st_registered=false WHERE id=${vendor.id}`;
  const salesApproval = await req(`/api/st-wht/batch/${salesBatch.id}/approve`);
  assert.equal(salesApproval.status, 409);
  assert.match(salesApproval.data.error, /inputs changed|snapshot/);
  assert.equal(
    (await req("/api/st-wht/calc", { companyId, year: 2025, month: 4 })).status,
    200,
  );
  const [revisedSales] =
    await sql`SELECT id,total_wht FROM st_wht_batches WHERE company_id=${companyId} AND year=2025 AND month=4`;
  const [configuredSales] =
    await sql`SELECT st_rate FROM st_wht_rules WHERE rule_key='fbr_goods_registered'`;
  assert.equal(
    Number(revisedSales.total_wht),
    1000 * Number(configuredSales.st_rate),
  );
  assert.equal(
    (await req(`/api/st-wht/batch/${revisedSales.id}/approve`)).status,
    200,
  );
  console.log(
    JSON.stringify({
      passed: true,
      capitalClearing: true,
      atomicAuditRollback: true,
      missingAuditIncomeAndSalesRejected: true,
      recalculationApproved: true,
    }),
  );
  await writeFile(
    "/tmp/taxtech-audit-round3-faults.json",
    JSON.stringify({ companyId, observations: [settings, mutation] }, null, 2),
    { mode: 0o600 },
  );
}
main().catch((e) => {
  console.error(
    String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]"),
  );
  process.exitCode = 1;
});
