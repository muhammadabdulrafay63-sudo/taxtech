/** Audit partial payments and interrupted-generation recovery in the isolated edge fixture. */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const { companyId } = JSON.parse(
    await readFile("/tmp/taxtech-reaudit-edges.json", "utf8"),
  );
  const [company] = await sql`SELECT name FROM companies WHERE id=${companyId}`;
  assert.equal(company.name, "Synthetic re-audit edge cases");
  const email = `reaudit-payments-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString("base64url"),
    hash = await bcrypt.hash(password, 12);
  await sql`INSERT INTO users(name,email,password_hash,role,company_id) VALUES ('Payment re-auditor',${email},${hash},'company_admin',${companyId})`;
  const base = "http://localhost:3000";
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
  async function req(path: string, body?: unknown) {
    const r = await fetch(base + path, {
      method: "POST",
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
    await sql`SELECT id FROM vendors WHERE company_id=${companyId} LIMIT 1`;
  for (const key of ["153_goods_company", "150_dividend_listed"]) {
    const [txn] =
      await sql`INSERT INTO gl_transactions(company_id,txn_date,description,amount,debit,vendor_id,review_status) VALUES (${companyId},'2025-02-15','Synthetic partial payment test',100000,100000,${vendor.id},'pending') RETURNING id`;
    const reviewed = await req("/api/transactions/review", {
      id: txn.id,
      decision: "approved",
      ruleKey: key,
      stRuleKey: null,
      note: "Synthetic supporting evidence verified for this test.",
    });
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed));
  }
  const calc = await req("/api/wht/calc", { companyId, year: 2025, month: 2 });
  assert.equal(calc.status, 200, JSON.stringify(calc));
  const batchId = calc.data.batchId;
  assert.equal((await req(`/api/wht/batch/${batchId}/approve`)).status, 200);
  const generated = await req(`/api/wht/batch/${batchId}/challans`);
  assert.equal(generated.status, 200);
  assert.equal(generated.data.created, 2);
  const challans =
    await sql`SELECT id,section,total_wht FROM challan_records WHERE batch_id=${batchId} ORDER BY section`;
  const paid = await req(`/api/wht/challan/${challans[0].id}/mark-paid`, {
    cprNumber: "SYNTHETIC-REAUDIT-NO-ACTUAL-PAYMENT",
    paymentDate: "2025-02-20",
  });
  assert.equal(paid.status, 200, JSON.stringify(paid));
  const html = await (
    await fetch(`${base}/company/${companyId}/recon/annual?year=2025`, {
      headers: { cookie },
    })
  ).text();
  const clean = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
  const paidCard = clean.slice(
    clean.indexOf("Total WHT Paid"),
    clean.indexOf("Total WHT Paid") + 100,
  );
  const [actual] =
    await sql`SELECT sum(total_wht)::text amount FROM challan_records WHERE batch_id=${batchId} AND cpr_number IS NOT NULL`;
  const partial = {
    case: "Partial payment reconciliation",
    recordedPaid: actual.amount,
    paidCard,
    safe:
      paidCard.includes("PKR 15,000.00") &&
      paidCard.includes("1 partially paid"),
  };
  assert.equal(partial.safe, true, JSON.stringify(partial));
  console.log(JSON.stringify(partial));
  // Simulate a request interrupted after one section was committed. Delete only our unpaid synthetic row.
  await sql`DELETE FROM challan_records WHERE id=${challans[1].id} AND cpr_number IS NULL`;
  const retried = await req(`/api/wht/batch/${batchId}/challans`);
  const remaining =
    await sql`SELECT section FROM challan_records WHERE batch_id=${batchId}`;
  const recovery = {
    case: "Recover incomplete section generation",
    expectedSections: 2,
    remainingSections: remaining.length,
    retry: retried,
    safe: remaining.length === 2,
  };
  assert.equal(recovery.safe, true, JSON.stringify(recovery));
  const [preserved] =
    await sql`SELECT id,cpr_number,total_wht FROM challan_records WHERE id=${challans[0].id}`;
  assert.equal(preserved.cpr_number, "SYNTHETIC-REAUDIT-NO-ACTUAL-PAYMENT");
  assert.equal(preserved.total_wht, challans[0].total_wht);
  const again = await req(`/api/wht/batch/${batchId}/challans`);
  assert.equal(
    again.data.added,
    0,
    "Retries do not duplicate or replace sections",
  );
  const [unpaid] =
    await sql`SELECT id FROM challan_records WHERE batch_id=${batchId} AND cpr_number IS NULL`;
  assert.equal(
    (
      await req(`/api/wht/challan/${unpaid.id}/mark-paid`, {
        cprNumber: "SYNTHETIC-REAUDIT-SECOND",
        paymentDate: "2025-02-20",
      })
    ).status,
    200,
  );
  const [final] = await sql`SELECT status FROM wht_batches WHERE id=${batchId}`;
  assert.equal(final.status, "paid");
  const [count] =
    await sql`SELECT count(*)::int n FROM challan_records WHERE batch_id=${batchId}`;
  assert.equal(count.n, 2);
  // A one-cent approved liability must never be labelled fully reconciled.
  const [tiny] =
    await sql`INSERT INTO gl_transactions(company_id,txn_date,description,amount,debit,vendor_id,review_status) VALUES (${companyId},'2025-04-15','Synthetic one-cent reconciliation case',0.25,0.25,${vendor.id},'pending') RETURNING id`;
  assert.equal(
    (
      await req("/api/transactions/review", {
        id: tiny.id,
        decision: "approved",
        ruleKey: "153_goods_company",
        stRuleKey: null,
        note: "Synthetic small invoice with verified recipient evidence.",
      })
    ).status,
    200,
  );
  const tinyCalc = await req("/api/wht/calc", {
    companyId,
    year: 2025,
    month: 4,
  });
  assert.equal(tinyCalc.status, 200, JSON.stringify(tinyCalc));
  assert.equal(Number(tinyCalc.data.totalWht), 0.01);
  assert.equal(
    (await req(`/api/wht/batch/${tinyCalc.data.batchId}/approve`)).status,
    200,
  );
  const centHtml = await (
    await fetch(`${base}/company/${companyId}/recon/annual?year=2025`, {
      headers: { cookie },
    })
  ).text();
  const centText = centHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
  assert.match(centText, /Variance PKR 0\.01 Under-paid/);
  assert.ok(!centText.includes("Fully reconciled"));
  console.log(
    JSON.stringify({
      ...recovery,
      paymentHistoryPreserved: true,
      fullPaymentStatus: final.status,
      oneCentVarianceCorrect: true,
    }),
  );
  await writeFile(
    "/tmp/taxtech-reaudit-payments.json",
    JSON.stringify(
      { companyId, batchId, observations: [partial, recovery] },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
