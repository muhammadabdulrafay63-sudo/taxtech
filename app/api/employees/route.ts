import { guardRoute } from "@/lib/route-guard";
import {
  withCompanyWrite,
  WorkflowError as WriteConflict,
} from "@/lib/workflow";
import { apiJSON } from "@/lib/api-response";
import { auth } from "@/auth";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { employeeInput } from "@/lib/validation";

const body = employeeInput;

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
        return apiJSON(
          {
            error:
              "Enter nonnegative salary amounts and Tax Year 2025, matching the supplied schedules.",
          },
          { status: 400 },
        );

      const {
        companyId,
        name,
        cnic,
        designation,
        monthlyGross,
        annualProjected,
        taxYear,
      } = parsed.data;

      const [emp] = await db
        .insert(employees)
        .values({
          companyId,
          name,
          cnic: cnic ?? null,
          designation: designation ?? null,
          monthlyGross: monthlyGross != null ? String(monthlyGross) : null,
          annualProjected:
            annualProjected != null ? String(annualProjected) : null,
          taxYear: taxYear ?? 2025,
        })
        .returning();

      return apiJSON(emp, { status: 201 });
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
