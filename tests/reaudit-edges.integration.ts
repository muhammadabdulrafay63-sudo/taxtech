/** Regression checks for the five re-audit fixes; creates only synthetic financial records. */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const base = "http://localhost:3000";
  const companyId = randomUUID(),
    userId = randomUUID();
  const email = `reaudit-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(password, 12);
  await sql.transaction([
    sql`INSERT INTO companies(id,name) VALUES (${companyId},'Synthetic re-audit edge cases')`,
    sql`INSERT INTO users(id,name,email,password_hash,role,company_id) VALUES (${userId},'Re-audit tester',${email},${hash},'company_admin',${companyId})`,
  ]);
  const csrf = await fetch(base + "/api/auth/csrf");
  const { csrfToken } = await csrf.json();
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
  const [vendor] =
    await sql`INSERT INTO vendors(company_id,name,is_filer) VALUES (${companyId},'Synthetic imported supplier',true) RETURNING id`;
  async function entry(date: string) {
    const [t] =
      await sql`INSERT INTO gl_transactions(company_id,txn_date,description,amount,debit,vendor_id,review_status) VALUES (${companyId},${date},'Synthetic audit goods',100000,100000,${vendor.id},'pending') RETURNING id`;
    const review = await req("/api/transactions/review", {
      id: t.id,
      decision: "approved",
      ruleKey: "153_goods_company",
      stRuleKey: null,
      note: "Synthetic audit fixture human review.",
    });
    assert.equal(review.status, 200, JSON.stringify(review));
    return t.id;
  }
  const observations: Record<string, unknown>[] = [];
  await entry("2025-01-15");
  const calc = await req("/api/wht/calc", { companyId, year: 2025, month: 1 });
  assert.equal(calc.status, 200, JSON.stringify(calc));
  assert.equal(
    calc.data.needsReview,
    1,
    "Missing recipient evidence is flagged even with known filer status",
  );
  // Simulate a legacy draft that predates the evidence flag; final approval must independently reject it.
  await sql`UPDATE wht_lines SET needs_review=false WHERE company_id=${companyId} AND period_year=2025 AND period_month=1`;
  const approval = await req(`/api/wht/batch/${calc.data.batchId}/approve`);
  assert.equal(
    approval.status,
    409,
    "Final approval independently checks current recipient evidence",
  );
  const [metadata] =
    await sql`SELECT recipient_type,recipient_type_verified_at FROM vendors WHERE id=${vendor.id}`;
  observations.push({
    case: "Unverified default recipient type",
    metadata,
    calcStatus: calc.status,
    needsReview: calc.data.needsReview,
    approvalStatus: approval.status,
    safe: approval.status === 409,
  });
  console.log(JSON.stringify(observations.at(-1)));
  assert.equal(
    (
      await req(
        `/api/vendors/${vendor.id}`,
        { recipientType: "company" },
        "PATCH",
      )
    ).status,
    200,
  );
  await entry("2027-01-15");
  const future = await req("/api/wht/calc", {
    companyId,
    year: 2027,
    month: 1,
  });
  assert.equal(future.status, 409, "Unsupported income period must be blocked");
  const futureSales = await req("/api/st-wht/calc", {
    companyId,
    year: 2027,
    month: 1,
  });
  assert.equal(
    futureSales.status,
    409,
    "Unsupported sales period must be blocked",
  );
  const [legacyFuture] =
    await sql`INSERT INTO wht_batches(company_id,year,month,status,total_gross,total_wht) VALUES (${companyId},2027,1,'draft',100000,4000) RETURNING id`;
  const futureApproval = await req(`/api/wht/batch/${legacyFuture.id}/approve`);
  assert.equal(
    futureApproval.status,
    409,
    "Legacy out-of-period draft must not reach approval",
  );
  observations.push({
    case: "Outside supplied tax-year basis",
    year: 2027,
    calcStatus: future.status,
    approvalStatus: futureApproval?.status,
    totalWht: future.data.totalWht,
    safe: future.status === 409,
  });
  console.log(JSON.stringify(observations.at(-1)));
  const march = await entry("2025-03-15");
  const before = await req("/api/wht/calc", {
    companyId,
    year: 2025,
    month: 3,
  });
  assert.equal(before.status, 200, JSON.stringify(before));
  for (const decision of ["pending", "approved"]) {
    const r = await req("/api/transactions/review", {
      id: march,
      decision,
      ruleKey: null,
      stRuleKey: null,
      note: "Synthetic evidence: no withholding treatment applies.",
    });
    assert.equal(r.status, 200, JSON.stringify(r));
  }
  const empty = await req("/api/wht/calc", { companyId, year: 2025, month: 3 });
  assert.equal(empty.status, 200, JSON.stringify(empty));
  assert.equal(empty.data.batchId, null);
  const leftovers =
    await sql`SELECT id,total_wht,status FROM wht_batches WHERE company_id=${companyId} AND year=2025 AND month=3`;
  assert.equal(leftovers.length, 0, "Obsolete income draft is removed");
  const [remainingLines] =
    await sql`SELECT count(*)::int n FROM wht_lines WHERE company_id=${companyId} AND period_year=2025 AND period_month=3`;
  assert.equal(remainingLines.n, 0);
  const staleApproval = await req(
    `/api/wht/batch/${before.data.batchId}/approve`,
  );
  observations.push({
    case: "Income recalculation with zero eligible entries",
    calcStatus: empty.status,
    error: empty.data.error,
    leftovers,
    staleApprovalStatus: staleApproval.status,
    safe: leftovers.length === 0,
  });
  console.log(JSON.stringify(observations.at(-1)));
  assert.ok(
    observations.every((o) => o.safe),
    JSON.stringify(observations),
  );
  await writeFile(
    "/tmp/taxtech-reaudit-edges.json",
    JSON.stringify({ companyId, observations }, null, 2),
    { mode: 0o600 },
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
