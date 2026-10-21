import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { calculateSTWHT } from "@/lib/stWHTEngine";
import { z } from "zod";

const body = z.object({
  companyId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user)
    return apiJSON({ error: "Unauthorized" }, { status: 401 });
  const writeCompany = (session!.user as { companyId?: string }).companyId;
  if (!writeCompany)
    return apiJSON(
      { error: "No company assigned." },
      { status: 403 },
    );
  try {
    return await withCompanyWrite(writeCompany, async () => {
      const parsed = body.safeParse(await req.json());
      if (!parsed.success)
        return apiJSON({ error: "Invalid body" }, { status: 400 });

      try {
        const result = await calculateSTWHT(
          parsed.data.companyId,
          parsed.data.year,
          parsed.data.month,
        );
        return apiJSON(result);
      } catch (error) {
        return apiJSON(
          {
            error:
              error instanceof Error ? error.message : "Calculation failed.",
          },
          { status: 409 },
        );
      }
    });
  } catch (error) {
    return apiJSON(
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
