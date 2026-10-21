import { auth } from "@/auth";
import { guardRoute } from "@/lib/route-guard";
import { apiJSON } from "@/lib/api-response";
import { mayResetJudgePractice, judgeFixture } from "@/lib/judge-fixture";
import { resetJudgePractice } from "@/lib/judge-demo";
import { withCompanyWrite, WorkflowError } from "@/lib/workflow";
export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  let body;
  try {
    body = await req.json();
  } catch {
    return apiJSON({ error: "Invalid request." }, { status: 400 });
  }
  if (!mayResetJudgePractice(session?.user, body?.confirmation))
    return apiJSON(
      {
        error:
          "This action is only available to the dedicated synthetic judge account.",
      },
      { status: 403 },
    );
  try {
    await withCompanyWrite(judgeFixture.companyId, resetJudgePractice);
    return apiJSON({ ok: true, period: judgeFixture.practicePeriod });
  } catch (error) {
    return apiJSON(
      {
        error:
          error instanceof WorkflowError
            ? error.message
            : "Demo reset could not be confirmed. Refresh before retrying or contact the owner.",
      },
      { status: 409 },
    );
  }
}
