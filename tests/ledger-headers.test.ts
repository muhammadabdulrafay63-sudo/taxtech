import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseGLBuffer, parseSheet } from "../lib/parser";
const mapping = {
  date: "Date",
  description: "Description",
  accountCode: "Account",
  debit: "Debit",
  credit: "Credit",
};
function workbook(extra: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Date", "Description", "Account", "Debit", "Credit", extra],
      ["2025-05-01", "Synthetic", "0001", 100000, 0, 1],
    ]),
    "Sheet1",
  );
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
test("preview and direct import reject exact, case and whitespace duplicate headings", () => {
  for (const heading of [
    "Debit",
    " debit ",
    "DEBIT",
    "Credit",
    "Date",
    "Description",
    "Account",
  ]) {
    const bytes = workbook(heading);
    assert.throws(
      () => parseGLBuffer(bytes, "fixture.xlsx"),
      /duplicate column name/,
    );
    assert.throws(
      () => parseSheet(bytes, "Sheet1", mapping),
      /duplicate column name/,
    );
  }
  const csv = Buffer.from(
    "Date,Description,Account,Debit,Credit,Debit\n2025-05-01,Synthetic,0001,100000,0,1\n",
  );
  const bytes = csv.buffer.slice(
    csv.byteOffset,
    csv.byteOffset + csv.byteLength,
  );
  assert.throws(
    () => parseGLBuffer(bytes, "fixture.csv"),
    /duplicate column name/,
  );
  assert.throws(
    () => parseSheet(bytes, "Sheet1", mapping),
    /duplicate column name/,
  );
});
test("uniquely renamed columns preserve both cells and the mapped amount", () => {
  const bytes = workbook("Other debit");
  const preview = parseGLBuffer(bytes, "fixture.xlsx").sheets[0];
  assert.equal(preview.sampleRows[0].Debit, 100000);
  assert.equal(preview.sampleRows[0]["Other debit"], 1);
  assert.equal(
    parseSheet(bytes, "Sheet1", mapping).rows[0].amount,
    "100000.00",
  );
  assert.equal(
    parseSheet(bytes, "Sheet1", { ...mapping, debit: "Other debit" }).rows[0]
      .amount,
    "1.00",
  );
});
test("blank unused headings do not collide; special named columns retain their values", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "Date",
        "Description",
        "Account",
        "Debit",
        "Credit",
        "",
        "",
        "__proto__",
      ],
      [
        "2025-05-01",
        "Synthetic",
        "0001",
        100000,
        0,
        "unused",
        "unused",
        "original",
      ],
    ]),
    "Sheet1",
  );
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  assert.equal(
    parseGLBuffer(bytes, "fixture.xlsx").sheets[0].sampleRows[0].__proto__,
    "original",
  );
  assert.equal(
    parseSheet(bytes, "Sheet1", mapping).rows[0].amount,
    "100000.00",
  );
});
