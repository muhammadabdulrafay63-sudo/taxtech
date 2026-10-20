/** Regression for Excel date epochs and atomic import recovery. Isolated install_* database only. */
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseSheet, parseGLBuffer, parseLedgerDate } from "../lib/parser";
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
    sql`INSERT INTO companies(id,name,paid_up_capital) VALUES (${companyId},'Isolated import audit fixture',250000)`,
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
  const observations: Record<string, unknown>[] = [];
  const expected = "2025-03-15";
  for (const date1904 of [false, true]) {
    const ref = date1904 ? "DATE1904" : "DATE1900";
    const serial =
      (Date.UTC(2025, 2, 15) -
        Date.UTC(
          date1904 ? 1904 : 1899,
          date1904 ? 0 : 11,
          date1904 ? 1 : 30,
        )) /
      86400000;
    const wb = XLSX.utils.book_new();
    wb.Workbook = { WBProps: { date1904 } };
    const ws = XLSX.utils.aoa_to_sheet([
      Object.values(mapping),
      [
        serial,
        "Synthetic Date Supplier - Purchase of goods",
        "GOODS",
        100000,
        0,
        ref,
      ],
    ]);
    ws.A2.z = "yyyy-mm-dd";
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const bytes = new Uint8Array(
      XLSX.write(wb, { type: "array", bookType: "xlsx" }),
    );
    const reopened = XLSX.read(bytes, { type: "array", cellDates: false });
    assert.equal(!!reopened.Workbook?.WBProps?.date1904, date1904);
    assert.equal(XLSX.SSF.format("yyyy-mm-dd", serial, { date1904 }), expected);
    const parsed = parseSheet(bytes.buffer as ArrayBuffer, "Sheet1", mapping);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].txnDate, expected);
    const localPreview = parseGLBuffer(
      bytes.buffer as ArrayBuffer,
      "fixture.xlsx",
    ).sheets[0];
    assert.equal(
      parseLedgerDate(localPreview.sampleRows[0].Date, localPreview.date1904),
      expected,
    );
    const preview = await upload(
      bytes,
      "date-fixture.xlsx",
      "/api/upload-gl/preview",
    );
    assert.equal(preview.status, 200, JSON.stringify(preview));
    const sheet = preview.data.sheets[0];
    assert.equal(sheet.date1904, date1904);
    assert.equal(
      parseLedgerDate(sheet.sampleRows[0].Date, sheet.date1904),
      expected,
    );
    const uploaded = await upload(bytes, "date-fixture.xlsx");
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded));
    const [saved] =
      await sql`SELECT txn_date::text AS txn_date FROM gl_transactions WHERE company_id=${companyId} AND ref=${ref}`;
    assert.equal(saved.txn_date, expected);
    assert.equal((await upload(bytes, "date-fixture.xlsx")).status, 409);
    const dates = {
      case: `Workbook ${date1904 ? "1904" : "1900"} date epoch`,
      expected,
      parsed: parsed.rows[0].txnDate,
      stored: saved.txn_date,
      safe: true,
    };
    observations.push(dates);
    console.log(JSON.stringify(dates));
  }
  const csv =
    "Date,Description,Account Code,Debit,Credit,Reference\n2025-04-01,Synthetic Fault Supplier - Purchase of goods,GOODS,20000,0,IMPORTFAIL\n2025-04-02,Synthetic Fault Supplier - Second goods invoice,GOODS,10000,0,IMPORTFAIL2\n";
  const before =
    await sql`SELECT (SELECT count(*) FROM vendors WHERE company_id=${companyId})::int vendors,(SELECT count(*) FROM gl_transactions WHERE company_id=${companyId})::int transactions,(SELECT count(*) FROM ledger_imports WHERE company_id=${companyId})::int receipts,(SELECT count(*) FROM audit_logs WHERE company_id=${companyId} AND action='IMPORT_LEDGER')::int audits`;
  const fn = "import_fault_" + randomUUID().replaceAll("-", "");
  let partial: unknown;
  try {
    await sql.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.company_id = '${companyId}'::uuid AND NEW.action = 'IMPORT_LEDGER' THEN RAISE EXCEPTION 'Synthetic isolated import audit outage'; END IF; RETURN NEW; END $$`,
    );
    await sql.query(
      `CREATE TRIGGER ${fn} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
    );
    const result = await upload(
      new TextEncoder().encode(csv),
      "failure-recovery.csv",
    );
    const after =
      await sql`SELECT (SELECT count(*) FROM vendors WHERE company_id=${companyId})::int vendors,(SELECT count(*) FROM gl_transactions WHERE company_id=${companyId})::int transactions,(SELECT count(*) FROM ledger_imports WHERE company_id=${companyId})::int receipts,(SELECT count(*) FROM audit_logs WHERE company_id=${companyId} AND action='IMPORT_LEDGER')::int audits`;
    assert.equal(result.status, 400, JSON.stringify(result));
    assert.deepEqual(
      after,
      before,
      "Failed imports leave suppliers, rows, receipts and audits unchanged",
    );
    partial = {
      case: "Failed import rolls back every new record",
      response: result,
      before: before[0],
      after: after[0],
      safe: true,
    };
    console.log(JSON.stringify(partial));
  } finally {
    await sql.query(`DROP TRIGGER IF EXISTS ${fn} ON audit_logs`);
    await sql.query(`DROP FUNCTION IF EXISTS ${fn}()`);
  }
  const recovered = await upload(
    new TextEncoder().encode(csv),
    "failure-recovery.csv",
  );
  assert.equal(recovered.status, 200, JSON.stringify(recovered));
  assert.equal(recovered.data.imported, 2);
  const [supplier] =
    await sql`SELECT count(*)::int n FROM vendors WHERE company_id=${companyId} AND name='Synthetic Fault Supplier'`;
  assert.equal(
    supplier.n,
    1,
    "Repeated supplier names reuse one preallocated ID",
  );
  const linked =
    await sql`SELECT DISTINCT vendor_id FROM gl_transactions WHERE company_id=${companyId} AND ref IN ('IMPORTFAIL','IMPORTFAIL2')`;
  assert.equal(linked.length, 1);
  assert.ok(linked[0].vendor_id);
  assert.equal(
    (await upload(new TextEncoder().encode(csv), "failure-recovery.csv"))
      .status,
    409,
  );
  observations.push(partial as Record<string, unknown>, {
    case: "Retry after failed import",
    safe: true,
    imported: 2,
    newSuppliers: 1,
    duplicateRejected: true,
  });
  console.log(JSON.stringify(observations.at(-1)));
  await writeFile(
    "/tmp/taxtech-audit-round4-imports.json",
    JSON.stringify({ companyId, observations }, null, 2),
    { mode: 0o600 },
  );
}
main().catch((e) => {
  console.error(
    String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]"),
  );
  process.exitCode = 1;
});
