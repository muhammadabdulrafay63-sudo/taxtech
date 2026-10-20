import { guardRoute } from "@/lib/route-guard";
import { auth } from "@/auth";
import { db } from "@/db";
import { glTransactions, vendors, auditLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { NextResponse } from "next/server";
import {
  withCompanyWrite,
  assertPeriodEditable,
  WorkflowError,
} from "@/lib/workflow";
const body = z.object({
  vendorId: z.string().uuid().nullable(),
  note: z.string().trim().min(3).max(1200),
});
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  const companyId = (session!.user as { companyId: string }).companyId;
  const input = body.safeParse(await req.json());
  if (!input.success)
    return NextResponse.json(
      { error: "Select a vendor and explain the change." },
      { status: 400 },
    );
  try {
    return await withCompanyWrite(companyId, async () => {
      const { id } = await params;
      const [txn] = await db
        .select()
        .from(glTransactions)
        .where(
          and(
            eq(glTransactions.id, id),
            eq(glTransactions.companyId, companyId),
          ),
        )
        .limit(1);
      if (!txn)
        return NextResponse.json(
          { error: "Entry not found." },
          { status: 404 },
        );
      await assertPeriodEditable(
        companyId,
        Number(txn.txnDate.slice(0, 4)),
        Number(txn.txnDate.slice(5, 7)),
      );
      if (
        input.data.vendorId &&
        !(
          await db
            .select({ id: vendors.id })
            .from(vendors)
            .where(
              and(
                eq(vendors.id, input.data.vendorId),
                eq(vendors.companyId, companyId),
              ),
            )
            .limit(1)
        ).length
      )
        return NextResponse.json(
          { error: "Choose a vendor from this company." },
          { status: 403 },
        );
      await db.batch([
        db
          .update(glTransactions)
          .set({
            vendorId: input.data.vendorId,
            reviewStatus: "pending",
            reviewNote: null,
            reviewedAt: null,
            reviewedBy: null,
            aiSuggestion: null,
          })
          .where(eq(glTransactions.id, id)),
        db
          .insert(auditLogs)
          .values({
            companyId,
            actorId: session!.user!.id!,
            action: "ASSIGN_VENDOR",
            entityType: "gl_transaction",
            entityId: id,
            payload: { previousVendorId: txn.vendorId, ...input.data },
          }),
      ]);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof WorkflowError
            ? error.message
            : "Could not assign vendor.",
      },
      { status: error instanceof WorkflowError ? 409 : 500 },
    );
  }
}
