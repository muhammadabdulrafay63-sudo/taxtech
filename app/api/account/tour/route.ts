import { guardRoute } from "@/lib/route-guard";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { TOUR_SEEN_ACTION } from "@/lib/app-tour";

// A preference for the signed-in account only; request bodies cannot select another user.
export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const userId = session.user.id;
  const companyId = (session.user as { companyId?: string }).companyId;
  try {
    // Serialize repeated tabs without a schema change. The audit record doubles
    // as the durable, account-scoped first-run preference across devices.
    await db.batch([
      db.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`app-tour:${userId}`},0))`,
      ),
      db.execute(sql`INSERT INTO audit_logs(company_id,actor_id,action,entity_type,entity_id)
        SELECT ${companyId}::uuid,${userId}::uuid,${TOUR_SEEN_ACTION},'user',${userId}
        WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE actor_id=${userId}::uuid AND action=${TOUR_SEEN_ACTION})`),
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not save your tour preference. You can keep using the app.",
      },
      { status: 503 },
    );
  }
}
