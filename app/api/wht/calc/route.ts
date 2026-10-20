import { LedgerAmountError } from "@/lib/money";
import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { calculateWHT } from "@/lib/whtEngine";
import { WorkflowError } from "@/lib/workflow";
import { z } from "zod";

const body = z.object({
  companyId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function POST(req: Request) {
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
      const parsed = body.safeParse(await req.json());
      if (!parsed.success)
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });

      try {
        const result = await calculateWHT(
          parsed.data.companyId,
          parsed.data.year,
          parsed.data.month,
        );
        return NextResponse.json(result);
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof WorkflowError || err instanceof LedgerAmountError
                ? err.message
                : "Calculation failed. The previous draft has been preserved.",
          },
          {
            status:
              err instanceof WorkflowError || err instanceof LedgerAmountError
                ? 409
                : 500,
          },
        );
      }
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
