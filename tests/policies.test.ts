import test from "node:test";
import assert from "node:assert/strict";
import { mapRows } from "../lib/parser";
import {
  canAccessCompany,
  needsAIReview,
  isValidISODate,
} from "../lib/review-policy";
import { validateSuggestions } from "../lib/ai/classify";
const mapping = {
  date: "Date",
  description: "Description",
  accountCode: "Account",
  debit: "Debit",
  credit: "Credit",
};
test("parser excludes opening balances and impossible dates, preserves credits and accounting negatives", () => {
  const result = mapRows(
    [
      { Date: "2026-10-01", Description: "Opening balance", Debit: 100 },
      { Date: "31/02/2026", Description: "Invalid", Debit: 100 },
      {
        Date: "19/10/2026",
        Description: "Supplier - stationery",
        Account: "10",
        Debit: "1,500.50",
        Credit: 0,
      },
      { Date: "2026-10-20", Description: "Reversal", Debit: 0, Credit: 100 },
      {
        Date: "2026-10-21",
        Description: "Negative adjustment",
        Debit: "(200.00)",
        Credit: 0,
      },
    ],
    mapping,
  );
  assert.equal(result.skipped, 2);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].amount, "1500.50");
  assert.equal(result.rows[0].txnDate, "2026-10-19");
  assert.equal(result.rows[1].amount, "-100.00");
  assert.equal(result.rows[2].amount, "-200.00");
  assert.equal(isValidISODate("2026-02-30"), false);
});
test("even company administrators cannot access another company", () => {
  assert.equal(
    canAccessCompany({ companyId: "a", role: "superadmin" }, "b"),
    false,
  );
  assert.equal(canAccessCompany({ companyId: "a" }, "a"), true);
});
test("only pending low-confidence entries go to AI", () => {
  assert.equal(
    needsAIReview({
      autoTag: null,
      tagConfidence: "0",
      reviewStatus: "pending",
    }),
    true,
  );
  assert.equal(
    needsAIReview({
      autoTag: "goods",
      tagConfidence: "0.9",
      reviewStatus: "pending",
    }),
    false,
  );
  assert.equal(
    needsAIReview({
      autoTag: null,
      tagConfidence: "0",
      reviewStatus: "excluded",
    }),
    false,
  );
});
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const suggestion = {
  id: a,
  ruleKey: "goods",
  explanation: "Goods purchase",
  missingInformation: [],
  confidence: 0.8,
};
test("rejects hallucinated rules, unknown rows, duplicates and missing rows", () => {
  assert.throws(() =>
    validateSuggestions(
      { suggestions: [{ ...suggestion, ruleKey: "invented" }] },
      [a],
      ["goods"],
    ),
  );
  assert.throws(() =>
    validateSuggestions(
      { suggestions: [{ ...suggestion, id: b }] },
      [a],
      ["goods"],
    ),
  );
  assert.throws(() =>
    validateSuggestions(
      { suggestions: [suggestion, suggestion] },
      [a, b],
      ["goods"],
    ),
  );
  assert.throws(() => validateSuggestions({ suggestions: [] }, [a], ["goods"]));
  assert.equal(
    validateSuggestions(
      { suggestions: [{ ...suggestion, ruleKey: null }] },
      [a],
      ["goods"],
    )[0].ruleKey,
    null,
  );
});

test("vendor memory cannot leak categories between vendors with the same prefix", async () => {
  const { tagTransaction } = await import("../lib/tagger");
  const row = {
    rowIndex: 0,
    txnDate: "2026-10-01",
    description: "Unclear support",
    accountCode: "",
    ref: "",
    folio: "",
    debit: "100.00",
    credit: "0.00",
    amount: "100.00",
    extractedVendorName: "Synthetic Partner",
  };
  const memory = [
    {
      name: "Synthetic Stationery",
      preferredRule: "goods",
      preferredStRule: null,
      province: null,
    },
  ];
  assert.equal(tagTransaction(row, [], memory, []).ruleKey, null);
  assert.equal(
    tagTransaction(
      { ...row, extractedVendorName: "Synthetic Stationery" },
      [],
      memory,
      [],
    ).ruleKey,
    "goods",
  );
});

test("persisted tax arithmetic rounds decimal half-cents and sums exactly", async () => {
  const { percentageTax, fractionOfTax, sumMoney } = await import(
    "../lib/money"
  );
  assert.equal(percentageTax("0.05", "10.000"), "0.01");
  assert.equal(percentageTax("100000.00", "4.000"), "4000.00");
  assert.equal(
    percentageTax("99999999999999.99", "15.000"),
    "15000000000000.00",
  );
  assert.equal(sumMoney(["0.10", "0.20"]), "0.30");
  assert.equal(fractionOfTax("17.00", "0.2000"), "3.40");
});
