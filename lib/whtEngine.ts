import {
  percentageTax,
  sumMoney,
  compareMoney,
  assertStoredMoney,
} from "./money";
import {
  calculationInputHash,
  recordCalculationInputs,
} from "./calculation-inputs";
import { hasRecipientEvidence } from "./tax-policy";
import { assertIncomePolicy } from "./ty2025";
import { validateTaxAssessment } from "./tax-assessment";
import { randomUUID } from "node:crypto";
import {
  assertCalculationEditable,
  assertPeriodReviewed,
  WorkflowError,
} from "./workflow";
import { db } from "@/db";
import {
  glTransactions,
  vendors,
  whtRules,
  whtLines,
  whtBatches,
  whtBatchItems,
} from "@/db/schema";
import { and, eq, isNotNull, sql, inArray } from "drizzle-orm";

export interface WHTEngineResult {
  batchId: string | null;
  linesCreated: number;
  linesSkipped: number;
  totalGross: string;
  totalWht: string;
  needsReview: number;
  warnings: string[];
}

export async function calculateWHT(
  companyId: string,
  year: number,
  month: number,
): Promise<WHTEngineResult> {
  await assertCalculationEditable(companyId, year, month, "income");
  await assertPeriodReviewed(companyId, year, month);
  const inputHash = await calculationInputHash(
    companyId,
    year,
    month,
    "income",
  );
  const warnings: string[] = [];
  const monthStr = String(month).padStart(2, "0");
  const periodStart = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${monthStr}-${lastDay}`;

  // 1. Fetch all tagged transactions for the period
  const txns = await db
    .select({
      id: glTransactions.id,
      amount: glTransactions.amount,
      autoTag: glTransactions.autoTag,
      stWhtTag: glTransactions.stWhtTag,
      vendorId: glTransactions.vendorId,
      txnDate: glTransactions.txnDate,
      taxAssessment: glTransactions.taxAssessment,
    })
    .from(glTransactions)
    .where(
      and(
        eq(glTransactions.companyId, companyId),
        isNotNull(glTransactions.autoTag),
        eq(glTransactions.reviewStatus, "approved"),
        sql`${glTransactions.txnDate} >= ${periodStart}`,
        sql`${glTransactions.txnDate} <= ${periodEnd}`,
      ),
    );

  if (txns.length === 0) {
    warnings.push("No tagged transactions found for this period.");
  }

  // 2. Load all relevant rules & vendors in bulk
  const rulKeys = [...new Set(txns.map((t) => t.autoTag!))];
  const vendorIds = [
    ...new Set(txns.map((t) => t.vendorId).filter((v): v is string => !!v)),
  ];

  const [rules, vendorList] = await Promise.all([
    rulKeys.length > 0
      ? db.select().from(whtRules).where(inArray(whtRules.ruleKey, rulKeys))
      : [],
    vendorIds.length > 0
      ? db
          .select({
            id: vendors.id,
            isFiler: vendors.isFiler,
            isNonResident: vendors.isNonResident,
            isExempt: vendors.isExempt,
            exemptionCertExpiry: vendors.exemptionCertExpiry,
            recipientType: vendors.recipientType,
            recipientTypeVerifiedAt: vendors.recipientTypeVerifiedAt,
          })
          .from(vendors)
          .where(inArray(vendors.id, vendorIds))
      : [],
  ]);

  const ruleMap = new Map(rules.map((r) => [r.ruleKey, r]));
  const vendorMap = new Map(vendorList.map((v) => [v.id, v]));

  // 3. Delete any existing wht_lines for this period (idempotent recalc)
  const existingBatch = await db
    .select({ id: whtBatches.id })
    .from(whtBatches)
    .where(
      and(
        eq(whtBatches.companyId, companyId),
        eq(whtBatches.year, year),
        eq(whtBatches.month, month),
      ),
    )
    .limit(1);

  // 4. Calculate WHT per transaction
  const grossValues: string[] = [];
  const taxValues: string[] = [];
  let linesSkipped = 0;
  let needsReview = 0;
  const linesToInsert: (typeof whtLines.$inferInsert)[] = [];

  for (const txn of txns) {
    if (compareMoney(txn.amount, "0") <= 0) {
      linesSkipped++;
      continue;
    }

    const rule = ruleMap.get(txn.autoTag!);
    if (!rule || !rule.active)
      throw new WorkflowError(
        `An approved entry uses an inactive or missing rule: ${txn.autoTag}. Correct its category before calculating.`,
      );
    try {
      assertIncomePolicy(rule);
    } catch (error) {
      throw new WorkflowError((error as Error).message);
    }
    let assessment;
    try {
      assessment = validateTaxAssessment(
        txn.taxAssessment,
        rule.ruleKey,
        txn.stWhtTag,
        txn.txnDate,
      );
    } catch (error) {
      throw new WorkflowError((error as Error).message);
    }
    const taxableGross = assessment!.incomeGross!;

    // Vendor exemption check
    const vendor = txn.vendorId ? vendorMap.get(txn.vendorId) : undefined;
    if (vendor?.isNonResident || vendor?.recipientType === "non_resident")
      throw new WorkflowError(
        "Resident withholding cases cannot be used for a non-resident recipient. Obtain specialist treaty/permanent-establishment treatment.",
      );
    if (
      vendor &&
      rule.recipientType !== "all" &&
      rule.recipientType !== vendor.recipientType
    )
      throw new WorkflowError(
        "An approved category does not match its vendor recipient type. Correct the category or verified vendor details.",
      );
    if (vendor?.isExempt) {
      if (!vendor.exemptionCertExpiry)
        throw new WorkflowError(
          "An exemption has no certificate expiry date. Verify its validity and scope before calculating.",
        );
      if (
        vendor.exemptionCertExpiry &&
        new Date(vendor.exemptionCertExpiry) < new Date(txn.txnDate!)
      ) {
        // Cert expired — fall through to normal calculation
        warnings.push(
          `Vendor exemption cert expired for txn ${txn.id} — applying normal rate`,
        );
      } else {
        linesSkipped++;
        continue;
      }
    }

    // Tax status
    let taxStatus: "filer" | "non_filer" | "unknown" = "unknown";
    if (vendor) {
      if (vendor.isFiler === true) taxStatus = "filer";
      else if (vendor.isFiler === false) taxStatus = "non_filer";
    }

    // Rate selection — unknown defaults to non-filer (safer, avoids under-deduction)
    const rate =
      taxStatus === "filer"
        ? parseFloat(rule.rateFiler)
        : parseFloat(rule.rateNonFiler);

    if (!Number.isFinite(rate) || rate < 0 || rate > 100)
      throw new WorkflowError(
        "A configured tax rate is invalid. Ask an administrator to correct it.",
      );
    const whtAmount = percentageTax(
      taxableGross,
      taxStatus === "filer" ? rule.rateFiler : rule.rateNonFiler,
    );
    grossValues.push(taxableGross);
    taxValues.push(whtAmount);
    const unresolved =
      taxStatus === "unknown" ||
      !hasRecipientEvidence(rule.recipientType, vendor);
    if (unresolved) needsReview++;

    linesToInsert.push({
      id: randomUUID(),
      companyId,
      glTxnId: txn.id,
      vendorId: txn.vendorId ?? null,
      ruleId: rule.id,
      periodYear: year,
      periodMonth: month,
      grossAmount: taxableGross,
      whtRate: rate.toString(),
      whtAmount,
      taxStatus,
      needsReview: unresolved,
    });
  }

  if (!linesToInsert.length) {
    await db.batch([
      db
        .delete(whtBatchItems)
        .where(
          existingBatch[0]
            ? eq(whtBatchItems.batchId, existingBatch[0].id)
            : sql`false`,
        ),
      db
        .delete(whtLines)
        .where(
          and(
            eq(whtLines.companyId, companyId),
            eq(whtLines.periodYear, year),
            eq(whtLines.periodMonth, month),
          ),
        ),
      db
        .delete(whtBatches)
        .where(
          existingBatch[0]
            ? eq(whtBatches.id, existingBatch[0].id)
            : sql`false`,
        ),
    ]);
    return {
      batchId: null,
      linesCreated: 0,
      linesSkipped,
      totalGross: "0.00",
      totalWht: "0.00",
      needsReview: 0,
      warnings: [
        ...warnings,
        "No eligible positive income withholding remains. Any obsolete draft was removed.",
      ],
    };
  }
  const totalGross = assertStoredMoney(sumMoney(grossValues));
  const totalWht = assertStoredMoney(sumMoney(taxValues));
  const batchId = randomUUID();
  // Neon HTTP batch executes these mutations in one transaction; a failure preserves the previous draft.
  await db.batch([
    db
      .delete(whtBatchItems)
      .where(
        existingBatch[0]
          ? eq(whtBatchItems.batchId, existingBatch[0].id)
          : sql`false`,
      ),
    db
      .delete(whtLines)
      .where(
        and(
          eq(whtLines.companyId, companyId),
          eq(whtLines.periodYear, year),
          eq(whtLines.periodMonth, month),
        ),
      ),
    db
      .delete(whtBatches)
      .where(
        existingBatch[0] ? eq(whtBatches.id, existingBatch[0].id) : sql`false`,
      ),
    db.insert(whtBatches).values({
      id: batchId,
      companyId,
      year,
      month,
      status: "draft",
      totalGross,
      totalWht,
    }),
    recordCalculationInputs(companyId, batchId, "income", inputHash),
    db.insert(whtLines).values(linesToInsert),
    db
      .insert(whtBatchItems)
      .values(linesToInsert.map((l) => ({ batchId, whtLineId: l.id! }))),
  ]);

  return {
    batchId,
    linesCreated: linesToInsert.length,
    linesSkipped,
    totalGross,
    totalWht,
    needsReview,
    warnings,
  };
}
