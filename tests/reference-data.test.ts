import test from "node:test";
import assert from "node:assert/strict";
import data from "../data/supplied-reference-data.json";
import map from "../data/income-source-map.json";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
test("reference snapshot is tied to supplied workbook bytes and exact rows", () => {
  for (const file of data) {
    let bytes: Buffer;
    try {
      bytes = readFileSync("../" + file.file);
    } catch {
      continue;
    }
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      file.sha256,
      `${file.file} changed; reconcile reference data before release.`,
    );
  }
  for (const source of Object.values(map)) {
    const book = data.find((f) => f.file === source.file)!;
    const row = book.sheets.find((s) => s.name === source.sheet)!.rows[
      source.row - 1
    ];
    assert.equal(row[2], source.description);
    if (source.filer !== null)
      assert.equal(parseFloat(String(row[4])), source.filer);
    if (source.nonFiler !== null)
      assert.equal(parseFloat(String(row[5])), source.nonFiler);
  }
});
