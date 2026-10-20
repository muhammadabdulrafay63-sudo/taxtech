import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedTaxPeriod, hasRecipientEvidence } from "../lib/tax-policy";
import { subtractMoney, sumMoney } from "../lib/money";
test("reconciliation preserves partial payments and one-cent differences", () => {
  assert.equal(subtractMoney("19000.00", "15000.00"), "4000.00");
  assert.equal(subtractMoney("100.01", "100.00"), "0.01");
  assert.equal(subtractMoney("100.00", "100.01"), "-0.01");
  assert.equal(subtractMoney(sumMoney(["0.10", "0.20"]), "0.30"), "0.00");
});
test("reference window follows the July to June tax year and rejects unsupported periods", () => {
  for (const [year, month, expected] of [
    [2024, 6, false],
    [2024, 7, true],
    [2024, 12, true],
    [2025, 1, true],
    [2025, 6, true],
    [2025, 7, false],
    [2027, 1, false],
    [2025, 13, false],
    [2025, 0, false],
  ] as const)
    assert.equal(isSupportedTaxPeriod(year, month), expected);
});
test("known filer status cannot substitute for recipient evidence", () => {
  assert.equal(
    hasRecipientEvidence("company", {
      recipientType: "company",
      recipientTypeVerifiedAt: null,
    }),
    false,
  );
  assert.equal(
    hasRecipientEvidence("company", {
      recipientType: "individual_aop",
      recipientTypeVerifiedAt: new Date(),
    }),
    false,
  );
  assert.equal(
    hasRecipientEvidence("company", {
      recipientType: "company",
      recipientTypeVerifiedAt: new Date(),
    }),
    true,
  );
  assert.equal(hasRecipientEvidence("company", null), false);
  assert.equal(hasRecipientEvidence("all", null), true);
});
