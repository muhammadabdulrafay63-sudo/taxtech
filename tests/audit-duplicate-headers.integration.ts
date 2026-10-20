/** Regression: duplicate headers fail without writes; uniquely renamed columns remain selectable. Synthetic install_* only. */
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseSheet, parseGLBuffer } from "../lib/parser";
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
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [...Object.values(mapping), "Debit"],
    [
      "2025-05-15",
      "Synthetic Ambiguous Supplier - Purchase of goods",
      "GOODS",
      100000,
      0,
      "DUPLICATEHEADER",
      1,
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const bytes = new Uint8Array(
    XLSX.write(wb, { type: "array", bookType: "xlsx" }),
  );
  const reopened = XLSX.read(bytes, { type: "array" });
  assert.equal(reopened.Sheets.Sheet1.D2.v, 100000);
  assert.equal(reopened.Sheets.Sheet1.G2.v, 1);
  assert.throws(
    () => parseGLBuffer(bytes.buffer as ArrayBuffer, "ambiguous.xlsx"),
    /duplicate column name/,
  );
  assert.throws(
    () => parseSheet(bytes.buffer as ArrayBuffer, "Sheet1", mapping),
    /duplicate column name/,
  );
  async function counts() {
    const [r] =
      await sql`SELECT (SELECT count(*) FROM vendors WHERE company_id=${companyId})::int vendors,(SELECT count(*) FROM gl_transactions WHERE company_id=${companyId})::int transactions,(SELECT count(*) FROM ledger_imports WHERE company_id=${companyId})::int receipts,(SELECT count(*) FROM audit_logs WHERE company_id=${companyId})::int audits`;
    return r;
  }
  const before = await counts();
  const preview = await upload(
    bytes,
    "ambiguous.xlsx",
    "/api/upload-gl/preview",
  );
  const response = await upload(bytes, "ambiguous.xlsx");
  assert.equal(preview.status, 400, JSON.stringify(preview));
  assert.match(
    preview.data.error,
    /duplicate column name.*Debit.*columns 4 and 7/,
  );
  assert.equal(response.status, 400, JSON.stringify(response));
  assert.match(response.data.error, /duplicate column name.*Debit/);
  assert.deepEqual(
    await counts(),
    before,
    "Rejected preview/import leaves no side effects",
  );
  // Rename the conflicting source heading and explicitly map the intended Debit.
  ws.G1 = { t: "s", v: "Other debit" };
  const corrected = new Uint8Array(
    XLSX.write(wb, { type: "array", bookType: "xlsx" }),
  );
  const acceptedPreview = await upload(
    corrected,
    "corrected.xlsx",
    "/api/upload-gl/preview",
  );
  assert.equal(acceptedPreview.status, 200);
  const correctedSheet = acceptedPreview.data.sheets[0];
  assert.equal(correctedSheet.sampleRows[0].Debit, 100000);
  assert.equal(correctedSheet.sampleRows[0]["Other debit"], 1);
  const correctedImport = await upload(corrected, "corrected.xlsx");
  assert.equal(correctedImport.status, 200, JSON.stringify(correctedImport));
  const [saved] =
    await sql`SELECT debit,credit,amount FROM gl_transactions WHERE company_id=${companyId} AND ref='DUPLICATEHEADER'`;
  assert.deepEqual(saved, {
    debit: "100000.00",
    credit: "0.00",
    amount: "100000.00",
  });
  assert.equal(
    (await upload(corrected, "corrected.xlsx")).status,
    409,
    "Successful import still rejects retries",
  );
  const result = {
    passed: true,
    duplicatePreviewRejected: true,
    directImportRejected: true,
    noSideEffects: true,
    correctedSourceImported: true,
    saved,
  };
  console.log(JSON.stringify(result));
  await writeFile(
    "/tmp/taxtech-round7-fixed-headers.json",
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
