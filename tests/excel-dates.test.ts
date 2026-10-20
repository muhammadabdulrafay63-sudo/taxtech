import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseSheet, parseGLBuffer, parseLedgerDate } from "../lib/parser";
const mapping = {
  date: "Date",
  description: "Description",
  accountCode: "Account",
  debit: "Debit",
  credit: "Credit",
};
for (const date1904 of [false, true]) {
  test(`serialized Excel ${date1904 ? "1904" : "1900"} dates agree in preview and import`, () => {
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
      [serial, "Synthetic date fixture", "GOODS", 100, 0],
      [serial + 0.5, "Synthetic time fixture", "GOODS", 100, 0],
      ["2025-03-15", "Synthetic text date", "GOODS", 100, 0],
    ]);
    ws.A2.z = "yyyy-mm-dd";
    ws.A3.z = "yyyy-mm-dd hh:mm";
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const bytes = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;
    const preview = parseGLBuffer(bytes, "fixture.xlsx").sheets[0];
    assert.equal(preview.date1904, date1904);
    for (const row of preview.sampleRows)
      assert.equal(parseLedgerDate(row.Date, preview.date1904), "2025-03-15");
    const imported = parseSheet(bytes, "Sheet1", mapping);
    assert.equal(imported.skipped, 0);
    assert.equal(imported.rows.length, 3);
    assert.deepEqual(
      imported.rows.map((r) => r.txnDate),
      ["2025-03-15", "2025-03-15", "2025-03-15"],
    );
  });
}
test("Excel early-date boundaries reject the fictitious 1900 leap day", () => {
  assert.equal(parseLedgerDate(59), "1900-02-28");
  assert.equal(parseLedgerDate(60), "");
  assert.equal(parseLedgerDate(61), "1900-03-01");
  assert.equal(parseLedgerDate(0, true), "1904-01-01");
  assert.equal(parseLedgerDate(-1, true), "");
  assert.equal(parseLedgerDate(Infinity, true), "");
});
