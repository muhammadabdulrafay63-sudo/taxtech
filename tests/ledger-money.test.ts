import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  parseLedgerMoney,
  formatMoney,
  subtractMoney,
  sumMoney,
  percentageTax,
  fractionOfTax,
} from "../lib/money";
import { mapRows, parseSheet, parseGLBuffer } from "../lib/parser";
const mapping = {
  date: "Date",
  description: "Description",
  accountCode: "Account",
  debit: "Debit",
  credit: "Credit",
};
const row = {
  Date: "2025-05-01",
  Description: "Synthetic precision",
  Account: "0001",
};
test("all cell types share strict amount syntax, precision and magnitude checks", () => {
  for (const [raw, expected] of [
    [null, "0.00"],
    ["", "0.00"],
    ["1,234.50", "1234.50"],
    ["(1,234.50)", "-1234.50"],
    ["+0001.2", "1.20"],
    [0.29, "0.29"],
    ["100000000000000.01", "100000000000000.01"],
    ["9999999999999999.99", "9999999999999999.99"],
  ] as const)
    assert.equal(parseLedgerMoney(raw), expected);
  for (const raw of [
    1.015,
    0.005,
    "1.015",
    "1,23",
    "100oops",
    true,
    NaN,
    Infinity,
    100000000000000.02,
    "10000000000000000.00",
    "1e3",
  ])
    assert.throws(() => parseLedgerMoney(raw));
});
test("debit minus credit stays exact across signed and large monetary rows", () => {
  for (let i = 1; i <= 2000; i++) {
    const debit = BigInt(i) * 1234567890123n,
      credit = BigInt(i) * 98765n;
    const text = (n: bigint) =>
      `${n / 100n}.${String(n % 100n).padStart(2, "0")}`;
    const mapped = mapRows(
      [{ ...row, Debit: text(debit), Credit: text(credit) }],
      mapping,
    ).rows[0];
    assert.equal(mapped.amount, text(debit - credit));
    assert.equal(subtractMoney(mapped.debit, mapped.credit), mapped.amount);
  }
  assert.throws(
    () =>
      mapRows(
        [{ ...row, Debit: "9999999999999999.99", Credit: "-0.01" }],
        mapping,
      ),
    /maximum/,
  );
});
test("a bad amount blocks a mixed file instead of allowing partial import", () => {
  assert.throws(
    () =>
      mapRows(
        [
          { ...row, Debit: "100.01", Credit: "0.01" },
          { ...row, Debit: 1.015, Credit: 0.005 },
        ],
        mapping,
      ),
    /Data row 2.*No rows/,
  );
});
test("serialized CSV and Excel text preserve exact cents and account identifiers", () => {
  const csv = Buffer.from(
    "Date,Description,Account,Debit,Credit\n2025-05-01,Synthetic,0001,100000000000000.01,0.00\n",
  );
  const bytes = csv.buffer.slice(
    csv.byteOffset,
    csv.byteOffset + csv.byteLength,
  );
  const parsed = parseSheet(bytes, "Sheet1", mapping).rows[0];
  assert.equal(parsed.amount, "100000000000000.01");
  assert.equal(parsed.accountCode, "0001");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      Object.values(mapping),
      ["2025-05-01", "Synthetic", "0001", "100000000000000.01", "0.00"],
    ]),
    "Sheet1",
  );
  const xlsx = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  assert.equal(
    parseGLBuffer(xlsx, "fixture.xlsx").sheets[0].sampleRows[0].Debit,
    "100000000000000.01",
  );
  assert.equal(
    parseSheet(xlsx, "Sheet1", mapping).rows[0].amount,
    parsed.amount,
  );
});
test("currency display and aggregates preserve every cent above Number precision", () => {
  assert.equal(formatMoney("100000000000000.01"), "100,000,000,000,000.01");
  assert.equal(formatMoney("-100000000000000.01"), "-100,000,000,000,000.01");
  assert.equal(sumMoney(["100000000000000.01", "0.01"]), "100000000000000.02");
  assert.equal(
    formatMoney(sumMoney(["9999999999999999.99", "9999999999999999.99"])),
    "19,999,999,999,999,999.98",
  );
  assert.equal(
    percentageTax("9999999999999999.99", "100.000"),
    "9999999999999999.99",
  );
  assert.equal(
    fractionOfTax("100000000000000.01", "1.0000"),
    "100000000000000.01",
  );
});
