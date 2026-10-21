import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGLBuffer, parseSheet } from "../lib/parser";
import { isSupportedTaxPeriod } from "../lib/tax-policy";

test("the downloadable demonstration ledger can reach a supported monthly calculation", () => {
  const bytes = readFileSync("public/sample-ledger.csv");
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const preview = parseGLBuffer(buffer, "sample-ledger.csv");
  const result = parseSheet(buffer, preview.sheets[0].sheetName, {
    date: "Date",
    description: "Description",
    accountCode: "Account Code",
    debit: "Debit",
    credit: "Credit",
    ref: "Reference",
  });
  assert.equal(result.rows.length, 4);
  assert.equal(result.skipped, 1);
  for (const row of result.rows) {
    const [year, month] = row.txnDate.split("-").map(Number);
    assert.equal(
      isSupportedTaxPeriod(year, month),
      true,
      "sample dates must match an active schedule",
    );
  }
});
