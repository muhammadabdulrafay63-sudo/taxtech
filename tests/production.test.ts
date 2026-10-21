import test from "node:test";
import assert from "node:assert/strict";
import { enforceRecipientEvidence } from "../lib/ai/classify";
import { employeeInput } from "../lib/validation";
import {
  generateAnnualObligations,
  addCalendarMonths,
  addCalendarDays,
  calcPenalty,
} from "../lib/secp";
import { calcSalaryWithSchedule, calcAnnualSalaryWHT } from "../lib/salaryWHT";
import { mapRows } from "../lib/parser";
test("AI recipient-specific advice requires verified metadata", () => {
  const id = crypto.randomUUID();
  const suggestion = {
    id,
    ruleKey: "goods_company",
    explanation: "Goods",
    confidence: 0.99,
    missingInformation: [],
  };
  const rules = [{ ruleKey: "goods_company", recipientType: "company" }];
  const unknown = enforceRecipientEvidence(
    [suggestion],
    [{ id, recipientType: null }],
    rules,
  )[0];
  assert.equal(unknown.ruleKey, null);
  assert.equal(unknown.confidence, 0);
  assert.ok(unknown.missingInformation.length);
  assert.equal(
    enforceRecipientEvidence(
      [suggestion],
      [{ id, recipientType: "company" }],
      rules,
    )[0].ruleKey,
    "goods_company",
  );
  assert.equal(
    enforceRecipientEvidence(
      [suggestion],
      [{ id, recipientType: "individual_aop" }],
      rules,
    )[0].ruleKey,
    null,
  );
});
test("salary validates amounts and the supplied schedule year", () => {
  const input = {
    companyId: crypto.randomUUID(),
    name: "Test",
    monthlyGross: 100000,
    taxYear: 2025,
  };
  assert.ok(employeeInput.safeParse(input).success);
  for (const patch of [
    { monthlyGross: -1 },
    { monthlyGross: Infinity },
    { monthlyGross: 0.001 },
    { taxYear: 2027 },
    { monthlyGross: null },
  ])
    assert.equal(
      employeeInput.safeParse({ ...input, ...patch }).success,
      false,
    );
  assert.ok(
    employeeInput.safeParse({ ...input, monthlyGross: 0, annualProjected: 0 })
      .success,
  );
});
test("SECP calendar follows source month-end, first AGM and actual-date formulas", () => {
  assert.equal(addCalendarMonths("2026-06-30", 4), "2026-10-31");
  assert.equal(addCalendarMonths("2024-02-29", 12), "2025-02-28");
  assert.equal(addCalendarDays("2026-10-15", 30), "2026-11-14");
  const annual = generateAnnualObligations(
    new Date("2026-06-30"),
    2026,
    "2020-01-01",
  );
  assert.equal(
    annual.find((o) => o.filingType === "AGM")!.dueDate,
    "2026-10-31",
  );
  assert.ok(annual.find((o) => o.filingType === "FORM_A")!.provisional);
  const first = generateAnnualObligations(
    new Date("2026-06-30"),
    2026,
    "2026-01-10",
  );
  assert.equal(
    first.find((o) => o.filingType === "AGM")!.dueDate,
    "2027-07-10",
  );
  assert.equal(
    generateAnnualObligations(new Date("2026-06-30"), 2025, "2026-01-10")
      .length,
    0,
  );
  assert.equal(calcPenalty("AGM", "2026-10-01", undefined, "2026-10-20"), 0);
  assert.equal(calcPenalty("AGM", "2026-10-01", 4, "2026-10-20"), 40000);
  assert.equal(
    calcPenalty("BENEFICIAL_OWNERSHIP", "2026-10-01", undefined, "2026-10-20"),
    0,
  );
  assert.equal(
    calcPenalty("FORM_A", "2026-10-01", undefined, "2026-10-20"),
    19000,
  );
});
test("salary engine supports reviewed schedules and rejects invalid bands", () => {
  assert.equal(calcAnnualSalaryWHT(100000).annualTax, 0);
  const source = {
    taxYear: 2025,
    source: "Synthetic unit-test schedule, not tax law",
    bands: [
      { lower: 0, upper: 1000, rate: 0, baseTax: 0 },
      { lower: 1000, upper: null, rate: 10, baseTax: 0 },
    ],
  };
  assert.equal(calcSalaryWithSchedule(1000, source).annualTax, 0);
  assert.equal(calcSalaryWithSchedule(2200, source).annualTax, 120);
  assert.throws(() => calcSalaryWithSchedule(-1, source), /nonnegative/);
  assert.throws(
    () => calcSalaryWithSchedule(2200, { ...source, bands: [source.bands[1]] }),
    /contiguous/,
  );
});
test("ledger rejects partially numeric text and normalized invalid timestamp dates", () => {
  const mapping = {
    date: "date",
    description: "description",
    accountCode: "code",
    debit: "debit",
    credit: "credit",
  };
  const base = {
    date: "2026-02-20",
    description: "Synthetic",
    code: "TEST",
    debit: 1000,
    credit: 0,
  };
  const result = mapRows(
    [
      { ...base, date: "2026-02-30T00:00:00Z" },
      { ...base, debit: "(1,000.00)" },
    ],
    mapping,
  );
  assert.equal(result.skipped, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].amount, "-1000.00");
  for (const debit of ["1000oops", "1,23"])
    assert.throws(
      () => mapRows([{ ...base, debit }], mapping),
      /valid numbers/,
    );
});
