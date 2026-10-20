/** Asserting regression for exact import, whole-file rejection, both tax lanes and exports. Synthetic install_* only. */
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseSheet } from "../lib/parser";
import {
  sumMoney,
  compareMoney,
  percentageTax,
  fractionOfTax,
  formatMoney,
} from "../lib/money";
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
    sql`INSERT INTO companies(id,name,paid_up_capital) VALUES (${companyId},'Isolated numeric audit fixture',250000)`,
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
  const session = await (
    await fetch(base + "/api/auth/session", { headers: { cookie } })
  ).json();
  assert.equal(session.user?.email, email);
  const mapping = {
    date: "Date",
    description: "Description",
    accountCode: "Account Code",
    debit: "Debit",
    credit: "Credit",
    ref: "Reference",
  };
  async function upload(
    bytes: Uint8Array,
    name: string,
    path = "/api/upload-gl/import",
  ) {
    const form = new FormData();
    form.set("file", new File([bytes as BlobPart], name));
    form.set("companyId", companyId);
    form.set("sheetName", "Sheet1");
    form.set("mapping", JSON.stringify(mapping));
    const res = await fetch(base + path, {
      method: "POST",
      headers: { cookie, Origin: base },
      body: form,
    });
    return { status: res.status, data: await res.json() };
  }
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
  await writeFile(
    "/tmp/taxtech-precision-browser.json",
    JSON.stringify({ companyId, email, password }),
    { mode: 0o600 },
  );
  const observations: object[] = [];
  const cases = [
    {
      label: "Two-decimal control",
      debit: 100.01,
      credit: 0.01,
      expectedDebit: "100.01",
      expectedCredit: "0.01",
      expectedAmount: "100.00",
    },
    {
      label: "Fractional-cent numeric Excel cells",
      debit: 1.015,
      credit: 0.005,
      expectedDebit: null,
      expectedCredit: null,
      expectedAmount: null,
    },
    {
      label: "Large exact decimal stored as text",
      debit: "100000000000000.01",
      credit: "0.00",
      expectedDebit: "100000000000000.01",
      expectedCredit: "0.00",
      expectedAmount: "100000000000000.01",
    },
    {
      label: "Unsafe large numeric Excel cell",
      debit: 100000000000000.02,
      credit: 0,
      expectedDebit: null,
      expectedCredit: null,
      expectedAmount: null,
    },
    {
      label: "Database amount overflow",
      debit: "10000000000000000.00",
      credit: "0.00",
      expectedDebit: null,
      expectedCredit: null,
      expectedAmount: null,
    },
    {
      label: "Negative adjustment",
      debit: "(200.00)",
      credit: 0,
      expectedDebit: "-200.00",
      expectedCredit: "0.00",
      expectedAmount: "-200.00",
    },
  ];
  function cents(value: string) {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  }
  for (const [i, test] of cases.entries()) {
    const ref = `PRECISION${i}`,
      wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      Object.values(mapping),
      [
        "2025-05-01",
        "Synthetic Precision Supplier - Purchase of goods",
        "GOODS",
        test.debit,
        test.credit,
        ref,
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const bytes = new Uint8Array(
      XLSX.write(wb, { type: "array", bookType: "xlsx" }),
    );
    if (i === 2)
      await writeFile("/tmp/taxtech-precision-preview.xlsx", bytes, {
        mode: 0o600,
      });
    const reopened = XLSX.read(bytes, { type: "array" });
    assert.equal(
      reopened.Sheets.Sheet1.D2.v,
      test.debit,
      "Serialized source value remains unchanged",
    );
    let parsed: ReturnType<typeof parseSheet> | undefined;
    try {
      parsed = parseSheet(bytes.buffer as ArrayBuffer, "Sheet1", mapping);
    } catch (error) {
      assert.equal(test.expectedDebit, null, String(error));
    }
    const [before] =
      await sql`SELECT count(*)::int n FROM gl_transactions WHERE company_id=${companyId}`;
    const response = await upload(bytes, `precision-${i}.xlsx`);
    const [saved] =
      await sql`SELECT debit,credit,amount FROM gl_transactions WHERE company_id=${companyId} AND ref=${ref}`;
    const balances = saved
      ? cents(saved.debit) - cents(saved.credit) === cents(saved.amount)
      : null;
    const sourcePreserved =
      saved && test.expectedDebit !== null
        ? saved.debit === test.expectedDebit &&
          saved.credit === test.expectedCredit &&
          saved.amount === test.expectedAmount
        : null;
    const rejected = response.status === 400 && !saved;
    const safe =
      rejected ||
      (test.expectedDebit !== null && !!sourcePreserved && balances === true);
    const result = {
      case: test.label,
      source: { debit: test.debit, credit: test.credit },
      parsed: parsed?.rows.map((row) => ({
        debit: row.debit,
        credit: row.credit,
        amount: row.amount,
      })),
      response,
      saved: saved ?? null,
      storedArithmeticBalances: balances,
      sourcePreserved,
      safe,
    };
    if (test.expectedDebit === null) {
      assert.equal(rejected, true, JSON.stringify(result));
      const [after] =
        await sql`SELECT count(*)::int n FROM gl_transactions WHERE company_id=${companyId}`;
      assert.equal(after.n, before.n);
    } else {
      assert.equal(response.status, 200, JSON.stringify(result));
      assert.equal(sourcePreserved, true);
      assert.equal(balances, true);
    }
    assert.equal(safe, true, JSON.stringify(result));
    observations.push(result);
    console.log(JSON.stringify(result));
  }
  // CSV keeps decimals as text too, including more than Excel's reliable numeric precision.
  const csv =
    "Date,Description,Account Code,Debit,Credit,Reference\n2025-05-02,Synthetic Precision Supplier - Purchase of goods,0001,100000000000000.01,0.00,CSVEXACT\n";
  const csvResult = await upload(new TextEncoder().encode(csv), "exact.csv");
  assert.equal(csvResult.status, 200, JSON.stringify(csvResult));
  const [csvSaved] =
    await sql`SELECT amount,account_code FROM gl_transactions WHERE company_id=${companyId} AND ref='CSVEXACT'`;
  assert.equal(csvSaved.amount, "100000000000000.01");
  assert.equal(csvSaved.account_code, "0001");
  const mixed =
    csv +
    "2025-05-03,Synthetic Must Not Persist - Purchase,0001,1.015,0.005,MIXEDBAD\n";
  const [beforeMixed] =
    await sql`SELECT (SELECT count(*) FROM gl_transactions WHERE company_id=${companyId})::int rows,(SELECT count(*) FROM vendors WHERE company_id=${companyId})::int vendors,(SELECT count(*) FROM ledger_imports WHERE company_id=${companyId})::int receipts`;
  const rejectedMixed = await upload(
    new TextEncoder().encode(mixed),
    "mixed.csv",
  );
  assert.equal(rejectedMixed.status, 400);
  assert.match(rejectedMixed.data.error, /Data row 2/);
  const [afterMixed] =
    await sql`SELECT (SELECT count(*) FROM gl_transactions WHERE company_id=${companyId})::int rows,(SELECT count(*) FROM vendors WHERE company_id=${companyId})::int vendors,(SELECT count(*) FROM ledger_imports WHERE company_id=${companyId})::int receipts`;
  assert.deepEqual(afterMixed, beforeMixed);
  observations.push({
    case: "Exact CSV and complete rejection of mixed invalid file",
    safe: true,
  });
  const txns =
    await sql`SELECT id,amount,vendor_id FROM gl_transactions WHERE company_id=${companyId}`;
  for (const vendorId of new Set(txns.map((t) => t.vendor_id)))
    assert.equal(
      (
        await req(
          `/api/vendors/${vendorId}`,
          { recipientType: "company", isFiler: true, isStRegistered: true },
          "PATCH",
        )
      ).status,
      200,
    );
  for (const txn of txns)
    assert.equal(
      (
        await req("/api/transactions/review", {
          id: txn.id,
          decision: compareMoney(txn.amount, "0") > 0 ? "approved" : "excluded",
          ruleKey: "153_goods_company",
          stRuleKey: "fbr_goods_registered",
          note: "Synthetic source and recipient evidence verified.",
        })
      ).status,
      200,
    );
  const positive = txns.filter((t) => compareMoney(t.amount, "0") > 0),
    expectedGross = sumMoney(positive.map((t) => t.amount));
  const [incomeRule] =
    await sql`SELECT rate_filer FROM wht_rules WHERE rule_key='153_goods_company'`;
  const [salesRule] =
    await sql`SELECT st_rate,wht_factor FROM st_wht_rules WHERE rule_key='fbr_goods_registered'`;
  const income = await req("/api/wht/calc", {
    companyId,
    year: 2025,
    month: 5,
  });
  assert.equal(income.status, 200, JSON.stringify(income));
  assert.equal(income.data.totalGross, expectedGross);
  assert.equal(
    income.data.totalWht,
    sumMoney(
      positive.map((t) => percentageTax(t.amount, incomeRule.rate_filer)),
    ),
  );
  const sales = await req("/api/st-wht/calc", {
    companyId,
    year: 2025,
    month: 5,
  });
  assert.equal(sales.status, 200, JSON.stringify(sales));
  const [salesBatch] =
    await sql`SELECT id,total_gross,total_wht FROM st_wht_batches WHERE company_id=${companyId} AND year=2025 AND month=5`;
  assert.equal(salesBatch.total_gross, expectedGross);
  assert.equal(
    salesBatch.total_wht,
    sumMoney(
      positive.map((t) =>
        fractionOfTax(
          percentageTax(t.amount, salesRule.st_rate),
          salesRule.wht_factor,
        ),
      ),
    ),
  );
  const lineAmounts =
    await sql`SELECT gross_amount FROM st_wht_lines WHERE company_id=${companyId}`;
  assert.equal(
    lineAmounts.filter((l) => l.gross_amount === "100000000000000.01").length,
    2,
  );
  assert.equal(
    (await req(`/api/wht/batch/${income.data.batchId}/approve`)).status,
    200,
  );
  assert.equal(
    (await req(`/api/st-wht/batch/${salesBatch.id}/approve`)).status,
    200,
  );
  assert.equal(
    (await req(`/api/wht/batch/${income.data.batchId}/challans`)).status,
    200,
  );
  const [challan] =
    await sql`SELECT id,total_gross FROM challan_records WHERE batch_id=${income.data.batchId}`;
  assert.equal(challan.total_gross, expectedGross);
  const pdf = await fetch(base + `/api/wht/challan/${challan.id}/pdf`, {
    headers: { cookie },
  });
  assert.equal(pdf.status, 200);
  await writeFile(
    "/tmp/taxtech-precision-fixed.pdf",
    Buffer.from(await pdf.arrayBuffer()),
    { mode: 0o600 },
  );
  for (const path of [
    `/company/${companyId}/transactions`,
    `/company/${companyId}/review?period=2025-05`,
    `/company/${companyId}/wht/batch/${income.data.batchId}`,
    `/company/${companyId}/st-wht/batch/${salesBatch.id}`,
    `/company/${companyId}/recon/annual?year=2025`,
  ]) {
    const r = await fetch(base + path, { headers: { cookie } });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(
      html.includes(
        formatMoney(
          path.includes("transactions") || path.includes("/review")
            ? "100000000000000.01"
            : expectedGross,
        ),
      ),
      path + " must render exact cents",
    );
  }
  observations.push({
    case: "Large and cent amounts through both tax lanes, approval, summaries and PDF response",
    safe: true,
    totalGross: expectedGross,
  });
  // Legacy inconsistent rows must not be silently used in either calculator.
  await sql`INSERT INTO gl_transactions(company_id,txn_date,description,debit,credit,amount,review_status,auto_tag,st_wht_tag,vendor_id) VALUES (${companyId},'2025-06-01','Synthetic legacy inconsistent entry',1.01,0.01,1.01,'approved','153_goods_company','fbr_goods_registered',${txns[0].vendor_id})`;
  for (const lane of ["wht", "st-wht"]) {
    const r = await req(`/api/${lane}/calc`, {
      companyId,
      year: 2025,
      month: 6,
    });
    assert.equal(r.status, 409, JSON.stringify(r));
    assert.match(r.data.error, /inconsistent/);
  }
  observations.push({
    case: "Legacy inconsistent monetary rows block both calculations",
    safe: true,
  });
  console.log(JSON.stringify({ passed: true, observations }));
  await writeFile(
    "/tmp/taxtech-round6-fixed-precision.json",
    JSON.stringify({ passed: true, companyId, observations }, null, 2),
    { mode: 0o600 },
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
