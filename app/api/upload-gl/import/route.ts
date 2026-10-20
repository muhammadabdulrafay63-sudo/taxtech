import { LedgerHeaderError } from "@/lib/parser";
import { LedgerAmountError } from "@/lib/money";
import { guardRoute } from "@/lib/route-guard";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseSheet } from "@/lib/parser";
import { tagBatch } from "@/lib/tagger";
import { db } from "@/db";
import {
  glTransactions,
  vendors,
  whtRules,
  companyAccountMappings,
  ledgerImports,
  auditLogs,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  assertPeriodEditable,
  withCompanyWrite,
  WorkflowError,
} from "@/lib/workflow";
import type { ImportResult } from "@/lib/types";
const mappingSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  accountCode: z.string().min(1),
  debit: z.string().min(1),
  credit: z.string().min(1),
  ref: z.string().optional(),
  folio: z.string().optional(),
});
export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId)
    return NextResponse.json(
      { error: "No company assigned." },
      { status: 403 },
    );
  try {
    return await withCompanyWrite(companyId, async () => {
      const data = await req.formData();
      const file = data.get("file");
      const sheetName = data.get("sheetName");
      if (data.get("companyId") !== companyId)
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      if (
        !(file instanceof File) ||
        !file.name.match(/\.(xlsx|xls|csv)$/i) ||
        file.size > 20 * 1024 * 1024 ||
        !file.size ||
        typeof sheetName !== "string"
      )
        return NextResponse.json(
          {
            error:
              "Choose a non-empty Excel or CSV file up to 20 MB and a sheet.",
          },
          { status: 400 },
        );
      const mapping = mappingSchema.parse(
        JSON.parse(String(data.get("mapping"))),
      );
      const mapped = Object.values(mapping).filter(Boolean);
      if (new Set(mapped).size !== mapped.length)
        return NextResponse.json(
          { error: "Map each field to a different column." },
          { status: 400 },
        );
      const buffer = await file.arrayBuffer();
      const fingerprint = createHash("sha256")
        .update(Buffer.from(buffer))
        .update(JSON.stringify({ sheetName, mapping }))
        .digest("hex");
      if (
        (
          await db
            .select({ id: ledgerImports.id })
            .from(ledgerImports)
            .where(
              and(
                eq(ledgerImports.companyId, companyId),
                eq(ledgerImports.fingerprint, fingerprint),
              ),
            )
            .limit(1)
        ).length
      )
        return NextResponse.json(
          {
            error:
              "This sheet has already been imported with these mappings. Open Review ledger instead.",
          },
          { status: 409 },
        );
      const { rows, skipped } = parseSheet(buffer, sheetName, mapping);
      if (!rows.length || rows.length > 5000)
        return NextResponse.json(
          {
            error: rows.length
              ? "Split the ledger into files of at most 5,000 valid entries."
              : "No valid rows found. Check dates and column mappings.",
          },
          { status: 400 },
        );
      for (const period of new Set(rows.map((r) => r.txnDate.slice(0, 7))))
        await assertPeriodEditable(
          companyId,
          Number(period.slice(0, 4)),
          Number(period.slice(5, 7)),
        );
      const [accountMappings, existingVendors, rules] = await Promise.all([
        db
          .select()
          .from(companyAccountMappings)
          .where(eq(companyAccountMappings.companyId, companyId)),
        db.select().from(vendors).where(eq(vendors.companyId, companyId)),
        db.select().from(whtRules).where(eq(whtRules.active, true)),
      ]);
      const tagged = tagBatch(
        rows,
        accountMappings,
        existingVendors,
        rules.map((r) => ({ ...r, keywords: r.keywords ?? [] })),
      );
      const vendorMap = new Map(
        existingVendors.map((v) => [v.name.toLowerCase(), v.id]),
      );
      const newVendors: (typeof vendors.$inferInsert)[] = [];
      for (const name of new Set(
        rows.map((r) => r.extractedVendorName).filter((n): n is string => !!n),
      )) {
        if (!vendorMap.has(name.toLowerCase())) {
          const id = crypto.randomUUID();
          newVendors.push({ id, companyId, name });
          vendorMap.set(name.toLowerCase(), id);
        }
      }
      const values = tagged.map((row) => ({
        companyId,
        sourceFile: file.name,
        txnDate: row.txnDate,
        description: row.description,
        accountCode: row.accountCode,
        ref: row.ref || null,
        folio: row.folio || null,
        debit: row.debit,
        credit: row.credit,
        amount: row.amount,
        vendorId: row.extractedVendorName
          ? vendorMap.get(row.extractedVendorName.toLowerCase())
          : null,
        extractedVendorName: row.extractedVendorName,
        autoTag: row.tag.ruleKey,
        tagConfidence: row.tag.confidence.toString(),
        tagSource: row.tag.source,
        stWhtTag: row.stWhtTag,
        reviewStatus: "pending",
      }));
      const chunks = [];
      for (let i = 0; i < values.length; i += 100)
        chunks.push(db.insert(glTransactions).values(values.slice(i, i + 100)));
      await db.batch([
        db.insert(ledgerImports).values({ companyId, fingerprint }),
        ...(newVendors.length ? [db.insert(vendors).values(newVendors)] : []),
        ...chunks,
        db.insert(auditLogs).values({
          companyId,
          actorId: session.user!.id,
          action: "IMPORT_LEDGER",
          entityType: "ledger_import",
          payload: { fingerprint, imported: values.length, skipped },
        }),
      ]);
      return NextResponse.json<ImportResult>({
        imported: values.length,
        skipped,
        tagged: tagged.filter((t) => !!t.tag.ruleKey).length,
        errors: [],
      });
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof WorkflowError ||
          error instanceof LedgerAmountError ||
          error instanceof LedgerHeaderError
            ? error.message
            : "Import failed. Check the sheet and column mappings; no transaction rows from this attempt were saved.",
      },
      { status: error instanceof WorkflowError ? 409 : 400 },
    );
  }
}
