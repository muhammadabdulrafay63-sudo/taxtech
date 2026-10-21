import test from "node:test";
import assert from "node:assert/strict";
import {
  incomePolicies,
  salesPolicies,
  assertIncomePolicy,
  assertSalesPolicy,
  TAX_POLICY_VERSION,
} from "../lib/ty2025";
import { validateTaxAssessment } from "../lib/tax-assessment";
import { calcAnnualSalaryWHT, calcSalaryWithSchedule } from "../lib/salaryWHT";
import { percentageTax, fractionOfTax } from "../lib/money";
import { deriveStWhtTag } from "../lib/tagger";

test("TY2025 section 153 rates and recipient basis agree with the historical statute", () => {
  for (const [key, filer, nonFiler] of [
    ["153_goods_company", "5", "10"],
    ["153_goods_individual", "5.5", "11"],
    ["153_services_company", "9", "18"],
    ["153_services_individual", "11", "22"],
    ["153_services_transport", "4", "8"],
    ["153_services_specified", "4", "8"],
    ["153_contract_company", "7.5", "15"],
    ["153_contract_individual", "8", "16"],
    ["153_media_advertising", "1.5", "3"],
  ]) {
    const p = incomePolicies[key];
    assert.equal(p.rateFiler, filer);
    assert.equal(p.rateNonFiler, nonFiler);
  }
  assert.equal(
    incomePolicies["155_rent_company_payer"].recipientType,
    "company",
  );
  const p = incomePolicies["153_goods_company"];
  assert.throws(
    () =>
      assertIncomePolicy({
        ruleKey: "153_goods_company",
        ...p,
        rateFiler: "4",
      }),
    /do not match/,
  );
  assert.throws(
    () =>
      assertIncomePolicy({
        ruleKey: "153_goods_company",
        ...p,
        thresholdAmount: "75000",
      }),
    /do not match/,
  );
  assert.throws(
    () => assertIncomePolicy({ ruleKey: "236k_property_purchase", ...p }),
    /outside/,
  );
});
test("explicit gross payment and invoice tax must agree; legacy and unconfirmed decisions fail closed", () => {
  const a = {
    version: TAX_POLICY_VERSION,
    eligibilityConfirmed: true,
    incomeGross: "118000.00",
    salesBase: "100000.00",
    salesTax: "18000.00",
  };
  assert.ok(
    validateTaxAssessment(
      a,
      "153_goods_company",
      "ty25_fbr_active_unregistered_buyer",
      "2025-06-01",
    ),
  );
  for (const bad of [
    null,
    { ...a, eligibilityConfirmed: false },
    { ...a, version: "legacy" },
    { ...a, incomeGross: "100000" },
    { ...a, salesTax: "17000" },
    { ...a, salesBase: "NaN" },
    { ...a, incomeGross: "0" },
  ])
    assert.throws(() =>
      validateTaxAssessment(
        bad,
        "153_goods_company",
        "ty25_fbr_active_unregistered_buyer",
        "2025-06-01",
      ),
    );
  assert.equal(validateTaxAssessment(null, null, null, "2025-06-01"), null);
  assert.equal(percentageTax(a.incomeGross, "5"), "5900.00");
});
test("all five sales authorities have explicit invoice cases; no generic full-WHT fallback", () => {
  const expected: Record<string, string> = {
    ty25_fbr_active_unregistered_buyer: "3600.00",
    ty25_fbr_active_registered_buyer: "0.00",
    ty25_srb_standard: "3000.00",
    ty25_srb_public: "12000.00",
    ty25_pra_registered_noncompany: "16000.00",
    ty25_pra_active_company: "0.00",
    ty25_kpra_standard: "7500.00",
    ty25_bra_standard: "3000.00",
  };
  for (const [key, p] of Object.entries(salesPolicies)) {
    assertSalesPolicy({ ruleKey: key, ...p }, "2025-06-01");
    assert.equal(
      fractionOfTax(percentageTax("100000", p.stRate), p.whtFactor),
      expected[key],
    );
    assert.throws(() =>
      assertSalesPolicy({ ruleKey: key, ...p, stRate: "NaN" }, "2025-06-01"),
    );
  }
  assert.equal(
    new Set(Object.values(salesPolicies).map((p) => p.authority)).size,
    5,
  );
  assert.throws(() =>
    assertSalesPolicy(
      { ruleKey: "ty25_kpra_standard", ...salesPolicies.ty25_kpra_standard },
      "2025-01-02",
    ),
  );
  assert.throws(() =>
    assertSalesPolicy(
      { ruleKey: "ty25_srb_standard", ...salesPolicies.ty25_srb_standard },
      "2025-07-01",
    ),
  );
  assert.equal(deriveStWhtTag("153_services_company", "Sindh", null), null);
  assert.equal(
    deriveStWhtTag("153_goods_company", null, "fbr_goods_registered"),
    null,
  );
});
test("TY2025 salary bands, exact boundaries and 10 percent surcharge", () => {
  for (const [income, tax] of [
    [0, 0],
    [600000, 0],
    [600001, 0.05],
    [1200000, 30000],
    [1200001, 30000.15],
    [2200000, 180000],
    [2200001, 180000.25],
    [3200000, 430000],
    [3200001, 430000.3],
    [4100000, 700000],
    [4100001, 700000.35],
    [10000000, 2765000],
    [10000001, 3041500.39],
  ])
    assert.equal(
      calcAnnualSalaryWHT(income).annualTax,
      tax,
      `income ${income}`,
    );
  assert.equal(calcAnnualSalaryWHT(10000000).surcharge, 0);
  assert.throws(() => calcAnnualSalaryWHT(150000001), /super-tax/);
  assert.throws(
    () =>
      calcSalaryWithSchedule(1200, {
        taxYear: 2025,
        source: "Synthetic invalid schedule",
        bands: [
          { lower: 0, upper: 1000, rate: 10, baseTax: 0 },
          { lower: 1000, upper: null, rate: 20, baseTax: 0 },
        ],
      }),
    /base tax/,
  );
});
