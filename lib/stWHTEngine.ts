/** Calculates only reviewed TY2025 invoice-based cases. Eligibility and invoice
 * amounts are recorded by the reviewer; no generic provincial or registration fallback.
 * Due dates and actual filing remain a separate compliance process. */
import {
  fractionOfTax,
  sumMoney,
  compareMoney,
  assertStoredMoney,
} from "./money";
import {
  calculationInputHash,
  recordCalculationInputs,
} from "./calculation-inputs";
import { randomUUID } from "node:crypto";
import {
  assertCalculationEditable,
  assertPeriodReviewed,
  WorkflowError,
} from "./workflow";
import { db } from "@/db";
import {
  glTransactions,
  stWhtRules,
  stWhtLines,
  stWhtBatches,
  stWhtBatchItems,
  vendors,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { assertSalesPolicy } from "./ty2025";
import { validateTaxAssessment } from "./tax-assessment";
import { hasRecipientEvidence } from "./tax-policy";

export async function calculateSTWHT(
  companyId: string,
  year: number,
  month: number,
): Promise<{ linesCreated: number; batches: Record<string, string> }> {
  await assertCalculationEditable(companyId, year, month, "sales");
  await assertPeriodReviewed(companyId, year, month);
  const inputHash = await calculationInputHash(companyId, year, month, "sales");
  // ── 1. Load tagged GL transactions for the period ──────────────────────────
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month < 12
      ? `${year}-${String(month + 1).padStart(2, "0")}-01`
      : `${year + 1}-01-01`;

  const txns = await db
    .select({
      id: glTransactions.id,
      amount: glTransactions.amount,
      vendorId: glTransactions.vendorId,
      stWhtTag: glTransactions.stWhtTag,
      autoTag: glTransactions.autoTag,
      txnDate: glTransactions.txnDate,
      taxAssessment: glTransactions.taxAssessment,
    })
    .from(glTransactions)
    .where(
      and(
        eq(glTransactions.companyId, companyId),
        eq(glTransactions.reviewStatus, "approved"),
        sql`${glTransactions.txnDate}::date >= ${startDate}::date`,
        sql`${glTransactions.txnDate}::date < ${endDate}::date`,
        sql`${glTransactions.stWhtTag} IS NOT NULL`,
      ),
    );

  async function clearEmptyDraft() {
    const batches = await db
      .select({ id: stWhtBatches.id })
      .from(stWhtBatches)
      .where(
        and(
          eq(stWhtBatches.companyId, companyId),
          eq(stWhtBatches.year, year),
          eq(stWhtBatches.month, month),
          eq(stWhtBatches.status, "draft"),
        ),
      );
    const ids = batches.map((b) => b.id);
    await db.batch([
      db
        .delete(stWhtBatchItems)
        .where(ids.length ? inArray(stWhtBatchItems.batchId, ids) : sql`false`),
      db
        .delete(stWhtLines)
        .where(
          and(
            eq(stWhtLines.companyId, companyId),
            eq(stWhtLines.periodYear, year),
            eq(stWhtLines.periodMonth, month),
          ),
        ),
      db
        .delete(stWhtBatches)
        .where(ids.length ? inArray(stWhtBatches.id, ids) : sql`false`),
    ]);
  }
  if (txns.length === 0) {
    await clearEmptyDraft();
    return { linesCreated: 0, batches: {} };
  }

  // ── 2. Load ST WHT rules ──────────────────────────────────────────────────
  const ruleKeys = [...new Set(txns.map((t) => t.stWhtTag!))];
  const rules = await db
    .select()
    .from(stWhtRules)
    .where(
      and(inArray(stWhtRules.ruleKey, ruleKeys), eq(stWhtRules.active, true)),
    );

  const ruleMap = new Map(rules.map((r) => [r.ruleKey, r]));

  // ── 3. Load vendor ST registration status ────────────────────────────────
  const vendorIds = [
    ...new Set(txns.map((t) => t.vendorId).filter(Boolean) as string[]),
  ];
  const vendorData =
    vendorIds.length > 0
      ? await db
          .select({
            id: vendors.id,
            isStRegistered: vendors.isStRegistered,
            recipientType: vendors.recipientType,
            recipientTypeVerifiedAt: vendors.recipientTypeVerifiedAt,
          })
          .from(vendors)
          .where(inArray(vendors.id, vendorIds))
      : [];
  const vendorMap = new Map(vendorData.map((v) => [v.id, v]));

  // ── 4. Delete existing ST WHT lines and batches for this period ───────────
  const existingBatches = await db
    .select({ id: stWhtBatches.id })
    .from(stWhtBatches)
    .where(
      and(
        eq(stWhtBatches.companyId, companyId),
        eq(stWhtBatches.year, year),
        eq(stWhtBatches.month, month),
      ),
    );

  // ── 5. Calculate ST WHT per transaction ──────────────────────────────────
  type LineInsert = typeof stWhtLines.$inferInsert;
  const newLines: LineInsert[] = [];

  for (const txn of txns) {
    const rule = ruleMap.get(txn.stWhtTag!);
    if (!rule)
      throw new WorkflowError(
        "An approved sales-tax category is missing or inactive. Review it before calculation.",
      );

    const vendor = txn.vendorId ? vendorMap.get(txn.vendorId) : undefined;
    const stRegisteredStatus: "registered" | "unregistered" | "unknown" =
      vendor?.isStRegistered === true
        ? "registered"
        : vendor?.isStRegistered === false
          ? "unregistered"
          : "unknown";

    if (compareMoney(txn.amount, "0") <= 0) continue;
    let assessment;
    try {
      assertSalesPolicy(rule, txn.txnDate);
      assessment = validateTaxAssessment(
        txn.taxAssessment,
        txn.autoTag,
        rule.ruleKey,
        txn.txnDate,
      );
    } catch (error) {
      throw new WorkflowError((error as Error).message);
    }
    if (stRegisteredStatus !== "registered")
      throw new WorkflowError(
        "These invoice-based sales-tax cases require a verified registered supplier. Unregistered or unknown status requires separate specialist treatment.",
      );
    const requiredRecipient =
      rule.ruleKey === "ty25_pra_registered_noncompany"
        ? "individual_aop"
        : rule.ruleKey === "ty25_pra_active_company"
          ? "company"
          : "all";
    if (!hasRecipientEvidence(requiredRecipient, vendor))
      throw new WorkflowError(
        "The verified provider type does not match this PRA case. Check whether the provider is a company or individual/AOP before calculating.",
      );
    const whtFactor = Number(rule.whtFactor);
    if (
      !Number.isFinite(Number(rule.stRate)) ||
      Number(rule.stRate) < 0 ||
      Number(rule.stRate) > 100 ||
      !Number.isFinite(whtFactor) ||
      whtFactor < 0 ||
      whtFactor > 1
    )
      throw new WorkflowError(
        "A configured sales-tax rate or factor is invalid.",
      );
    const stAmount = assessment!.salesTax!;
    const whtAmount = fractionOfTax(stAmount, whtFactor.toFixed(4));

    newLines.push({
      id: randomUUID(),
      companyId,
      glTxnId: txn.id,
      vendorId: txn.vendorId ?? null,
      ruleId: rule.id,
      periodYear: year,
      periodMonth: month,
      grossAmount: assessment!.salesBase!,
      stRate: rule.stRate,
      stAmount,
      whtFactor: whtFactor.toFixed(4),
      whtAmount,
      authority: rule.authority,
      stRegisteredStatus,
      needsReview: false,
    });
  }

  if (newLines.length === 0) {
    await clearEmptyDraft();
    return { linesCreated: 0, batches: {} };
  }

  const groups = new Map<string, LineInsert[]>();
  for (const line of newLines)
    groups.set(line.authority, [...(groups.get(line.authority) ?? []), line]);
  const batches = [...groups].map(([authority, lines]) => ({
    id: randomUUID(),
    companyId,
    year,
    month,
    authority,
    totalGross: assertStoredMoney(sumMoney(lines.map((l) => l.grossAmount))),
    totalSt: assertStoredMoney(sumMoney(lines.map((l) => l.stAmount))),
    totalWht: assertStoredMoney(sumMoney(lines.map((l) => l.whtAmount))),
  }));
  const batchIds = existingBatches.map((b) => b.id);
  await db.batch([
    db
      .delete(stWhtBatchItems)
      .where(
        batchIds.length
          ? inArray(stWhtBatchItems.batchId, batchIds)
          : sql`false`,
      ),
    db
      .delete(stWhtLines)
      .where(
        and(
          eq(stWhtLines.companyId, companyId),
          eq(stWhtLines.periodYear, year),
          eq(stWhtLines.periodMonth, month),
        ),
      ),
    db
      .delete(stWhtBatches)
      .where(batchIds.length ? inArray(stWhtBatches.id, batchIds) : sql`false`),
    db.insert(stWhtBatches).values(batches),
    ...batches.map((b) =>
      recordCalculationInputs(companyId, b.id, "sales", inputHash),
    ),
    db.insert(stWhtLines).values(newLines),
    db
      .insert(stWhtBatchItems)
      .values(
        batches.flatMap((b) =>
          groups
            .get(b.authority)!
            .map((l) => ({ batchId: b.id, stWhtLineId: l.id! })),
        ),
      ),
  ]);
  return {
    linesCreated: newLines.length,
    batches: Object.fromEntries(batches.map((b) => [b.authority, b.totalWht])),
  };
}
