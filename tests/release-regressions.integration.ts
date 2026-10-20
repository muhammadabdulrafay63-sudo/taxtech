/** Run after submission-audit.integration.ts. Mutates only that isolated test company. */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const base = "http://localhost:3000";
  const account = JSON.parse(
    await readFile("/tmp/taxtech-audit-account.json", "utf8"),
  );
  const { companyId, email } = account;
  const csrf = await fetch(base + "/api/auth/csrf");
  const { csrfToken } = await csrf.json();
  let cookie = [
    ...new Map(
      csrf.headers
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
    body: new URLSearchParams({ csrfToken, email, password: account.password }),
  });
  cookie +=
    "; " +
    login.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
  async function req(path: string, body?: unknown, method = "POST") {
    const res = await fetch(base + path, {
      method,
      headers: {
        cookie,
        Origin: base,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  }
  const checks: string[] = [];
  const [vendor] =
    await sql`INSERT INTO vendors(company_id,name,recipient_type,is_filer,atl_last_checked_at,recipient_type_verified_at) VALUES (${companyId},'Synthetic verified assignment vendor','company',true,now(),now()) RETURNING id`;
  const may =
    await sql`SELECT id FROM gl_transactions WHERE company_id=${companyId} AND txn_date >= '2025-05-01' AND txn_date < '2025-06-01' AND vendor_id IS NULL`;
  assert.equal(may.length, 2);
  for (const row of may) {
    const r = await req(
      `/api/transactions/${row.id}/vendor`,
      {
        vendorId: vendor.id,
        note: "Synthetic vendor association to exercise the complete supplied-ledger review path; not a claim about the real supplier.",
      },
      "PATCH",
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    const [saved] =
      await sql`SELECT review_status,ai_suggestion FROM gl_transactions WHERE id=${row.id}`;
    assert.equal(saved.review_status, "pending");
    assert.equal(saved.ai_suggestion, null);
    assert.equal(
      (
        await req("/api/transactions/review", {
          id: row.id,
          decision: "approved",
          ruleKey: "153_goods_company",
          stRuleKey: null,
          note: "Test-only supporting supplier metadata verified; real ledger remains separate.",
        })
      ).status,
      200,
    );
  }
  const calc = await req("/api/wht/calc", { companyId, year: 2025, month: 5 });
  assert.equal(calc.status, 200, JSON.stringify(calc));
  assert.equal(calc.data.needsReview, 0);
  assert.equal(
    (await req(`/api/wht/batch/${calc.data.batchId}/approve`)).status,
    200,
  );
  checks.push(
    "missing vendors assigned, reviews reopened and final batch approved",
  );
  assert.equal(
    (
      await req(
        `/api/transactions/${may[0].id}/vendor`,
        { vendorId: null, note: "Test approved period lock." },
        "PATCH",
      )
    ).status,
    409,
  );
  checks.push("approved periods reject vendor reassignment");
  const p = {
    companyId,
    incorporationDate: "2024-01-01",
    financialYearEnd: "2026-06-30",
    paidUpCapital: 250000,
    registeredOffice: "Updated synthetic office",
    officerCount: 4,
  };
  const before =
    await sql`SELECT id,filed_date FROM secp_obligations WHERE secp_company_id IN (SELECT id FROM secp_companies WHERE company_id=${companyId}) AND status='filed'`;
  assert.equal((await req("/api/secp/setup", p, "PATCH")).status, 200);
  const after =
    await sql`SELECT id,filed_date FROM secp_obligations WHERE secp_company_id IN (SELECT id FROM secp_companies WHERE company_id=${companyId}) AND status='filed'`;
  assert.deepEqual(after, before);
  checks.push("SECP profile edits preserve filed history");
  const [agm] =
    await sql`SELECT o.id FROM secp_obligations o JOIN secp_companies c ON c.id=o.secp_company_id WHERE c.company_id=${companyId} AND o.filing_type='AGM' AND o.period_year=2026`;
  assert.ok(agm);
  assert.equal(
    (
      await req(
        `/api/secp/obligations/${agm.id}`,
        { status: "filed", filedDate: "2026-10-15" },
        "PATCH",
      )
    ).status,
    200,
  );
  const dependents =
    await sql`SELECT o.filing_type,o.due_date::text AS due_date,o.provisional FROM secp_obligations o JOIN secp_companies c ON c.id=o.secp_company_id WHERE c.company_id=${companyId} AND o.period_year=2026 AND o.filing_type IN ('FORM_A','FORM_28','AUDITED_ACCOUNTS')`;
  assert.equal(dependents.length, 3);
  for (const d of dependents) {
    assert.equal(
      d.due_date,
      d.filing_type === "FORM_28" ? "2026-10-30" : "2026-11-14",
    );
    assert.equal(d.provisional, false);
  }
  checks.push("actual AGM sets dependent deadlines");
  const event = await req("/api/secp/events", {
    kind: "event",
    filingType: "FORM_29",
    triggerDate: "2026-10-01",
    notes: "Synthetic officer change recorded for calendar test.",
  });
  assert.equal(event.status, 200);
  checks.push("event-based filing calendar");
  const headers = await fetch(base + "/login");
  assert.equal(headers.headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.headers.get("x-frame-options"), "DENY");
  checks.push("security headers");
  const [pending] =
    await sql`SELECT id FROM gl_transactions WHERE company_id=${companyId} AND review_status='pending' LIMIT 1`;
  const [foreignCompany] =
    await sql`INSERT INTO companies(name) VALUES ('Synthetic foreign assignment check') RETURNING id`;
  const [foreignVendor] =
    await sql`INSERT INTO vendors(company_id,name) VALUES (${foreignCompany.id},'Synthetic foreign') RETURNING id`;
  assert.equal(
    (
      await req(
        `/api/transactions/${pending.id}/vendor`,
        { vendorId: foreignVendor.id, note: "Must be rejected." },
        "PATCH",
      )
    ).status,
    403,
  );
  checks.push("foreign-company vendor assignment denied");
  const other = await fetch(base + `/company/${foreignCompany.id}/review.rsc`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert.ok([307, 403, 404].includes(other.status));
  checks.push("foreign transport route denied");
  await sql`UPDATE vendors SET recipient_type_verified_at=null WHERE id=${vendor.id}`;
  const [metadataTxn] =
    await sql`INSERT INTO gl_transactions(company_id,txn_date,description,account_code,amount,vendor_id,review_status) VALUES (${companyId},'2026-04-01','Purchase of office computers','MISC',1000,${vendor.id},'pending') RETURNING id`;
  const evidenceResponse = await req("/api/ai/review", {
    companyId,
    ids: [metadataTxn.id],
  });
  assert.equal(evidenceResponse.status, 200, JSON.stringify(evidenceResponse));
  const [evidenceSaved] =
    await sql`SELECT ai_suggestion FROM gl_transactions WHERE id=${metadataTxn.id}`;
  assert.equal(evidenceSaved.ai_suggestion.ruleKey, null);
  assert.ok(evidenceSaved.ai_suggestion.missingInformation.length);
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
  const [confirmedVendor] =
    await sql`SELECT recipient_type_verified_at FROM vendors WHERE id=${vendor.id}`;
  assert.ok(confirmedVendor.recipient_type_verified_at);
  checks.push(
    "filer status alone cannot establish verified recipient type for AI",
  );
  const [profile] =
    await sql`SELECT id FROM secp_companies WHERE company_id=${companyId}`;
  const [legacy] =
    await sql`INSERT INTO secp_obligations(secp_company_id,filing_type,due_date,origin,status) VALUES (${profile.id},'FORM_A','2026-01-01','legacy','pending') RETURNING id`;
  assert.equal(
    (
      await req(
        `/api/secp/obligations/${legacy.id}`,
        { status: "filed", filedDate: "2026-10-20" },
        "PATCH",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await req(
        `/api/secp/obligations/${legacy.id}`,
        {
          dueDate: "2026-11-14",
          notes:
            "Synthetic source evidence reconciled for the inherited deadline.",
        },
        "PATCH",
      )
    ).status,
    200,
  );
  const [reconciled] =
    await sql`SELECT origin,due_date::text AS due FROM secp_obligations WHERE id=${legacy.id}`;
  assert.equal(reconciled.origin, "manual");
  assert.equal(reconciled.due, "2026-11-14");
  checks.push(
    "legacy calendar requires evidence reconciliation without replacing history",
  );
  const next = randomBytes(24).toString("base64url");
  assert.equal(
    (
      await req("/api/account/password", {
        currentPassword: "wrong",
        newPassword: next,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/api/account/password", {
        currentPassword: account.password,
        newPassword: next,
      })
    ).status,
    200,
  );
  account.password = next;
  await writeFile("/tmp/taxtech-audit-account.json", JSON.stringify(account), {
    mode: 0o600,
  });
  assert.equal(
    (
      await req("/api/ai/assistant", {
        pathname: "/dashboard",
        question: "test",
      })
    ).status,
    401,
  );
  checks.push(
    "password rotation rejects wrong password and revokes old sessions",
  );
  await writeFile(
    "/tmp/taxtech-audit/release-regressions.json",
    JSON.stringify({ passed: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
