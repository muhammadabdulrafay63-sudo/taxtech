import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  judgeFixture as f,
  judgeExamples,
  mayResetJudgePractice,
} from "../lib/judge-fixture";
import { percentageTax, sumMoney, fractionOfTax } from "../lib/money";
import { validateTaxAssessment } from "../lib/tax-assessment";
import {
  TAX_POLICY_VERSION,
  incomePolicies,
  salesPolicies,
} from "../lib/ty2025";
test("demo reset is scoped to one synthetic user/company and an explicit confirmation", () => {
  const user = { id: f.userId, companyId: f.companyId, role: "accountant" };
  assert.equal(mayResetJudgePractice(user, "RESET_SYNTHETIC_APRIL"), true);
  for (const bad of [
    null,
    { ...user, id: "another-user" },
    { ...user, companyId: "another-company" },
    { ...user, role: "viewer" },
    { ...user, role: "superadmin" },
  ])
    assert.equal(mayResetJudgePractice(bad, "RESET_SYNTHETIC_APRIL"), false);
  assert.equal(mayResetJudgePractice(user, null), false);
  assert.equal(mayResetJudgePractice(user, "reset"), false);
  assert.notEqual(f.preparedPeriod, f.practicePeriod);
});
test("invented judge invoices reconcile and produce the documented TY2025 totals", () => {
  const values: string[] = [];
  const sales: Record<string, string> = {};
  for (const e of judgeExamples) {
    if (!e.incomeKey) continue;
    assert.ok(
      validateTaxAssessment(
        {
          version: TAX_POLICY_VERSION,
          eligibilityConfirmed: true,
          incomeGross: e.incomeGross,
          salesBase: e.amount,
          salesTax: e.salesTax,
        },
        e.incomeKey,
        e.salesKey,
        "2025-04-" + e.day,
      ),
    );
    values.push(
      percentageTax(e.incomeGross!, incomePolicies[e.incomeKey].rateFiler),
    );
    const p = salesPolicies[e.salesKey!];
    sales[p.authority] = fractionOfTax(e.salesTax!, p.whtFactor);
  }
  assert.equal(sumMoney(values), "16250.00");
  assert.deepEqual(sales, { FBR: "3600.00", SRB: "3000.00" });
  const csv = readFileSync("public/judge-demo-ledger.csv", "utf8");
  assert.match(csv, /2025-05-07/);
  assert.equal(csv.trim().split("\n").length, 4);
});
