/** Run after test:workflow; exercises the retained synthetic workspace only. */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const { companyId, otherCompanyId, email, password } = JSON.parse(
    await readFile("/tmp/taxtech-workflow-account.json", "utf8"),
  );
  const sql = neon(process.env.DATABASE_URL!);
  const base = "http://localhost:3000";
  const csrfRes = await fetch(base + "/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  let cookie = [
    ...new Map(
      csrfRes.headers
        .getSetCookie()
        .map((v) => [v.split("=")[0], v.split(";")[0]]),
    ).values(),
  ].join("; ");
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
  async function post(path: string, body?: unknown) {
    const res = await fetch(base + path, {
      method: "POST",
      headers: {
        cookie,
        Origin: base,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  }
  const [rule] =
    await sql`SELECT * FROM wht_rules WHERE active=true AND uses_slab_rates=false AND is_tiered=false AND rule_key LIKE '153_goods%' ORDER BY rule_key LIMIT 1`;
  const [txn] =
    await sql`INSERT INTO gl_transactions(company_id,txn_date,description,account_code,amount,debit,auto_tag,review_status) VALUES (${companyId},'2024-12-01','Synthetic safety-test goods','GOODS',1000,1000,${rule.rule_key},'pending') RETURNING id`;
  const [user] = await sql`SELECT id FROM users WHERE email=${email}`;
  const reviewBody = {
    id: txn.id,
    decision: "approved",
    ruleKey: rule.rule_key,
    stRuleKey: null,
    note: "Synthetic goods invoice reviewed.",
  };
  assert.equal(
    (
      await post("/api/transactions/review", {
        ...reviewBody,
        ruleKey: "invented-rule",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/api/transactions/review", {
        ...reviewBody,
        expectedSuggestionAt: "stale-time",
      })
    ).status,
    409,
  );
  const approved = await post("/api/transactions/review", reviewBody);
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  const reopened = await post("/api/transactions/review", {
    ...reviewBody,
    decision: "pending",
    note: "Reopen for correction.",
  });
  assert.equal(reopened.status, 200, JSON.stringify(reopened.data));
  assert.equal(
    (await post("/api/wht/calc", { companyId, year: 2024, month: 12 })).status,
    409,
  );
  await post("/api/transactions/review", reviewBody);
  const draft = await post("/api/wht/calc", {
    companyId,
    year: 2024,
    month: 12,
  });
  assert.equal(draft.status, 200, JSON.stringify(draft.data));
  assert.equal(
    (await post(`/api/wht/batch/${draft.data.batchId}/approve`)).status,
    409,
    "Unknown filer status must block approval",
  );
  // Another company's page and resource are denied even if their IDs are known.
  const [foreign] =
    await sql`INSERT INTO vendors(company_id,name) VALUES (${otherCompanyId},'Synthetic foreign vendor') RETURNING id`;
  const foreignRead = await fetch(base + `/company/${otherCompanyId}/review`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(foreignRead.status, 307);
  const foreignPatch = await fetch(base + `/api/vendors/${foreign.id}`, {
    method: "PATCH",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ isFiler: true }),
  });
  assert.equal(foreignPatch.status, 403);
  // A held lease blocks a second mutation instead of racing it.
  await sql`INSERT INTO workflow_locks(company_id,token,expires_at) VALUES (${companyId},'boundary-test',now()+interval '1 minute')`;
  try {
    assert.equal(
      (
        await post("/api/transactions/review", {
          ...reviewBody,
          decision: "pending",
        })
      ).status,
      409,
    );
  } finally {
    await sql`DELETE FROM workflow_locks WHERE company_id=${companyId} AND token='boundary-test'`;
  }
  // Financial changes after calculation require regeneration, even when all rows are reviewed.
  await sql`INSERT INTO audit_logs(company_id,actor_id,action,entity_type) VALUES (${companyId},${user.id},'UPDATE_VENDOR','vendor')`;
  const stale = await post(`/api/wht/batch/${draft.data.batchId}/approve`);
  assert.equal(stale.status, 409);
  assert.match(stale.data.error, /changed since calculation/);
  // Reopening an approved/paid month remains forbidden.
  const [paidTxn] =
    await sql`SELECT id FROM gl_transactions WHERE company_id=${companyId} AND txn_date='2024-10-02' LIMIT 1`;
  assert.equal(
    (
      await post("/api/transactions/review", {
        ...reviewBody,
        id: paidTxn.id,
        decision: "pending",
      })
    ).status,
    400,
  );
  console.log({
    passed: true,
    checks: [
      "unknown rules rejected",
      "stale suggestion rejected",
      "review can reopen",
      "reopen restores calculation gate",
      "unknown vendor blocks approval",
      "foreign resource blocked",
      "concurrent writes blocked",
      "stale draft blocked",
      "paid-month reopen blocked",
    ],
  });
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
