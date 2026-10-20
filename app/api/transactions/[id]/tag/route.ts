import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { glTransactions, vendors, auditLogs, whtRules } from "@/db/schema";
import { assertPeriodEditable } from "@/lib/workflow";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { deriveStWhtTag } from "@/lib/tagger";

const body = z.object({
  ruleKey: z.string().nullable(),
  updateVendorMemory: z.boolean().optional().default(false),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const writeCompany = (session!.user as { companyId?: string }).companyId;
  if (!writeCompany)
    return NextResponse.json(
      { error: "No company assigned." },
      { status: 403 },
    );
  try {
    return await withCompanyWrite(writeCompany, async () => {
      const { id: txnId } = await params;
      const parsed = body.safeParse(await req.json());
      if (!parsed.success)
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });

      const { ruleKey, updateVendorMemory } = parsed.data;

      // Fetch the transaction + vendor province for ST re-derivation
      const [txn] = await db
        .select({
          id: glTransactions.id,
          txnDate: glTransactions.txnDate,
          vendorId: glTransactions.vendorId,
          companyId: glTransactions.companyId,
          stWhtTag: glTransactions.stWhtTag,
        })
        .from(glTransactions)
        .where(eq(glTransactions.id, txnId))
        .limit(1);

      if (!txn)
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 },
        );

      try {
        await assertPeriodEditable(
          txn.companyId,
          Number(txn.txnDate.slice(0, 4)),
          Number(txn.txnDate.slice(5, 7)),
        );
      } catch {
        return NextResponse.json(
          { error: "This period is approved and locked." },
          { status: 409 },
        );
      }
      if (
        ruleKey &&
        !(
          await db
            .select({ id: whtRules.id })
            .from(whtRules)
            .where(
              and(eq(whtRules.ruleKey, ruleKey), eq(whtRules.active, true)),
            )
            .limit(1)
        ).length
      )
        return NextResponse.json({ error: "Invalid rule." }, { status: 400 });

      // Re-derive ST WHT tag when income tag changes (unless ST tag was manually set)
      let newStWhtTag = txn.stWhtTag; // keep existing by default
      if (txn.vendorId) {
        const [vendor] = await db
          .select({
            province: vendors.province,
            preferredStRule: vendors.preferredStRule,
          })
          .from(vendors)
          .where(eq(vendors.id, txn.vendorId))
          .limit(1);
        if (vendor) {
          newStWhtTag = deriveStWhtTag(
            ruleKey,
            vendor.province,
            vendor.preferredStRule,
          );
        }
      } else {
        // No vendor — still derive based on income tag alone (works for goods)
        newStWhtTag = deriveStWhtTag(ruleKey, null, null);
      }

      // Update tag
      const update = db
        .update(glTransactions)
        .set({
          autoTag: ruleKey,
          reviewStatus: "pending",
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          aiSuggestion: null,
          tagConfidence: ruleKey ? "1.00" : "0",
          tagSource: ruleKey ? "manual" : "none",
          stWhtTag: newStWhtTag,
        })
        .where(eq(glTransactions.id, txnId));

      const memory =
        updateVendorMemory && txn.vendorId && ruleKey
          ? [
              db
                .update(vendors)
                .set({ preferredRule: ruleKey })
                .where(eq(vendors.id, txn.vendorId)),
            ]
          : [];
      await db.batch([
        update,
        ...memory,
        // Audit log
        db.insert(auditLogs).values({
          companyId: txn.companyId,
          actorId: session.user!.id! as string,
          action: "OVERRIDE_TAG",
          entityType: "gl_transaction",
          entityId: txnId,
          payload: { ruleKey, updateVendorMemory },
        }),
      ]);

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof WriteConflict
            ? error.message
            : "Unable to complete the change. Please retry.",
      },
      { status: error instanceof WriteConflict ? 409 : 500 },
    );
  }
}
