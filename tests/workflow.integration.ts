/** Opt-in: run against a local development server and non-production database. */
import dotenv from "dotenv";
import { TAX_POLICY_VERSION } from "../lib/ty2025";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
dotenv.config({ path: ".env.local", quiet: true });
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
  throw new Error("Use a local development server for this test.");
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const companyId = randomUUID();
  const otherCompanyId = randomUUID();
  const userId = randomUUID();
  const email = `workflow-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  const [rule] =
    await sql`SELECT * FROM wht_rules WHERE active=true AND uses_slab_rates=false AND is_tiered=false AND rule_key LIKE '153_goods%' ORDER BY rule_key LIMIT 1`;
  assert.ok(rule, "Seed illustrative rules before integration testing.");
  await sql.transaction([
    sql`INSERT INTO companies(id,name) VALUES (${companyId},'TaxTech synthetic workflow test'),(${otherCompanyId},'TaxTech isolation test')`,
    sql`INSERT INTO users(id,name,email,password_hash,role,company_id) VALUES (${userId},'Workflow tester',${email},${passwordHash},'company_admin',${companyId})`,
    sql`INSERT INTO company_account_mappings(company_id,account_code,rule_key) VALUES (${companyId},'GOODS',${rule.rule_key})`,
  ]);
  await writeFile(
    "/tmp/taxtech-workflow-account.json",
    JSON.stringify({ companyId, otherCompanyId, email, password }),
    { mode: 0o600 },
  );
  let cookie = "";
  const csrfResponse = await fetch(`${base}/api/auth/csrf`);
  const csrf = await csrfResponse.json();
  cookie = [
    ...new Map(
      csrfResponse.headers
        .getSetCookie()
        .map((v) => [v.split("=")[0], v.split(";")[0]]),
    ).values(),
  ].join("; ");
  const login = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie,
      Origin: base,
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      callbackUrl: `${base}/dashboard`,
    }),
  });
  cookie +=
    "; " +
    login.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
  const session = await (
    await fetch(`${base}/api/auth/session`, { headers: { cookie } })
  ).json();
  assert.equal(session.user?.email, email, "Fixture login works");
  async function post(path: string, body?: unknown, method = "POST") {
    const res = await fetch(base + path, {
      method,
      headers: {
        cookie,
        Origin: base,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { status: res.status, data };
  }
  const mapping = {
    date: "Date",
    description: "Description",
    accountCode: "Account Code",
    debit: "Debit",
    credit: "Credit",
    ref: "Reference",
  };
  const csv =
    "Date,Description,Account Code,Debit,Credit,Reference\n2024-10-01,Opening balance,OPEN,100,0,BBF\n2024-10-02,Synthetic Stationery - Purchase of office stationery,GOODS,100000,0,A1\n2024-10-03,Synthetic Services - Combined support arrangement renewal,MISC,25000,0,A2\n2024-10-04,Own-account transfer,TRANSFER,5000,0,A3\n";
  async function upload(target = companyId) {
    const form = new FormData();
    form.set("companyId", target);
    form.set("sheetName", "Sheet1");
    form.set("mapping", JSON.stringify(mapping));
    form.set("file", new File([csv], "workflow.csv", { type: "text/csv" }));
    const res = await fetch(base + "/api/upload-gl/import", {
      method: "POST",
      headers: { cookie, Origin: base },
      body: form,
    });
    return { status: res.status, data: await res.json() };
  }
  const imported = await upload();
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  assert.equal(imported.data.imported, 3);
  assert.equal(imported.data.skipped, 1);
  assert.equal((await upload()).status, 409, "Duplicate import rejected");
  assert.equal(
    (await upload(otherCompanyId)).status,
    403,
    "Cross-company multipart import rejected",
  );
  const before = await post("/api/wht/calc", {
    companyId,
    year: 2024,
    month: 10,
  });
  assert.equal(before.status, 409, "Pending reviews block calculation");
  const transactions =
    await sql`SELECT * FROM gl_transactions WHERE company_id=${companyId} ORDER BY txn_date`;
  const unclear = transactions.filter((t) => t.account_code !== "GOODS");
  const ai = await post("/api/ai/review", {
    companyId,
    ids: unclear.map((t) => t.id),
  });
  assert.equal(ai.status, 200, JSON.stringify(ai.data));
  assert.match(ai.data.model, /^nvidia\//);
  const [suggested] =
    await sql`SELECT ai_suggestion,review_status FROM gl_transactions WHERE id=${unclear[0].id}`;
  assert.ok(suggested.ai_suggestion.explanation);
  assert.equal(suggested.review_status, "pending", "AI never approves");
  const assistant = await post("/api/ai/assistant", {
    pathname: `/company/${companyId}/review`,
    question: "Why is batch generation blocked, and what should I do next?",
  });
  assert.equal(assistant.status, 200, JSON.stringify(assistant.data));
  assert.ok(assistant.data.answer.length > 20);
  assert.ok(
    assistant.data.links.every(
      (l: { href: string }) =>
        l.href.startsWith(`/company/${companyId}/`) || l.href === "/dashboard",
    ),
  );
  const vendor = transactions[0].vendor_id;
  assert.ok(vendor);
  const update = await post(
    `/api/vendors/${vendor}`,
    { isFiler: true, recipientType: "company" },
    "PATCH",
  );
  assert.equal(update.status, 200, JSON.stringify(update.data));
  const employee = await post("/api/employees", {
    companyId,
    name: "Synthetic salary estimate",
    monthlyGross: 100000,
    annualProjected: 1200000,
    taxYear: 2025,
  });
  assert.equal(employee.status, 201, JSON.stringify(employee.data));
  const salaryPage = await fetch(`${base}/company/${companyId}/wht/salary`, {
    headers: { cookie },
  });
  assert.equal(salaryPage.status, 200);
  assert.match(await salaryPage.text(), /2500.00/);
  for (const txn of transactions) {
    if (txn.account_code === "GOODS") {
      const missingAssessment = await post("/api/transactions/review", {
        id: txn.id,
        decision: "approved",
        ruleKey: rule.rule_key,
        stRuleKey: null,
        note: "Synthetic evidence without invoice assessment",
      });
      assert.equal(
        missingAssessment.status,
        400,
        "Legacy review payload cannot approve without invoice evidence",
      );
    }
    const review = await post("/api/transactions/review", {
      id: txn.id,
      decision: txn.account_code === "GOODS" ? "approved" : "excluded",
      ruleKey: txn.account_code === "GOODS" ? rule.rule_key : null,
      stRuleKey: null,
      taxAssessment: {
        version: TAX_POLICY_VERSION,
        eligibilityConfirmed: true,
        incomeGross: "100000.00",
      },
      note:
        txn.account_code === "GOODS"
          ? "Synthetic invoice verified as goods; filer status confirmed."
          : "Synthetic ambiguous or internal transfer excluded pending evidence.",
      rememberVendor: txn.account_code === "GOODS",
    });
    assert.equal(review.status, 200, JSON.stringify(review.data));
  }
  const cross = await post("/api/wht/calc", {
    companyId: otherCompanyId,
    year: 2024,
    month: 10,
  });
  assert.equal(cross.status, 403);
  const calculated = await post("/api/wht/calc", {
    companyId,
    year: 2024,
    month: 10,
  });
  assert.equal(calculated.status, 200, JSON.stringify(calculated.data));
  assert.equal(calculated.data.linesCreated, 1);
  assert.equal(
    Number(calculated.data.totalWht),
    (100000 * Number(rule.rate_filer)) / 100,
  );
  assert.equal(calculated.data.needsReview, 0);
  const recalculated = await post("/api/wht/calc", {
    companyId,
    year: 2024,
    month: 10,
  });
  assert.equal(recalculated.status, 200, JSON.stringify(recalculated.data));
  const [batchCount] =
    await sql`SELECT count(*) AS n FROM wht_batches WHERE company_id=${companyId}`;
  assert.equal(
    Number(batchCount.n),
    1,
    "Recalculation replaces, not duplicates",
  );
  const batchId = recalculated.data.batchId;
  const approved = await post(`/api/wht/batch/${batchId}/approve`);
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  assert.equal(
    (await post("/api/wht/calc", { companyId, year: 2024, month: 10 })).status,
    409,
    "Approved periods cannot be recalculated",
  );
  assert.equal(
    (
      await post(
        `/api/transactions/${transactions[0].id}/tag`,
        { ruleKey: rule.rule_key },
        "PATCH",
      )
    ).status,
    409,
    "Approved period tag edit blocked",
  );
  const challans = await post(`/api/wht/batch/${batchId}/challans`);
  assert.equal(challans.status, 200, JSON.stringify(challans.data));
  const [challan] =
    await sql`SELECT id FROM challan_records WHERE batch_id=${batchId}`;
  const pdf = await fetch(`${base}/api/wht/challan/${challan.id}/pdf`, {
    headers: { cookie },
  });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
  await post(`/api/wht/challan/${challan.id}/mark-paid`, {
    cprNumber: "SYNTHETIC-NOT-A-REAL-PAYMENT",
    paymentDate: "2024-10-19",
  });
  await post(`/api/wht/batch/${batchId}/challans`);
  const [paid] =
    await sql`SELECT cpr_number FROM challan_records WHERE id=${challan.id}`;
  assert.ok(paid?.cpr_number, "Regeneration preserves recorded payment");
  await sql`UPDATE users SET role='viewer' WHERE id=${userId}`;
  assert.equal(
    (await post("/api/wht/calc", { companyId, year: 2024, month: 10 })).status,
    403,
    "Viewer cannot mutate",
  );
  await sql`UPDATE users SET role='company_admin' WHERE id=${userId}`;
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks: [
          "login",
          "upload and duplicate protection",
          "company isolation",
          "real NVIDIA/Nebius review",
          "AI remains pending",
          "real contextual assistance",
          "human approval and vendor memory",
          "deterministic batch arithmetic",
          "atomic recalculation",
          "approved-period protection",
          "PDF export",
          "payment history retained",
          "viewer permissions",
        ],
        fixtureCompanyId: companyId,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
