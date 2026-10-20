import { db } from "@/db";
import { sql } from "drizzle-orm";
import { AIError } from "./nebius";
// Atomic, database-backed quotas work across serverless instances. Each attempt costs one unit.
export async function claimAIRequest(
  companyId: string,
  userId: string,
  kind: string,
) {
  const bucket = `${userId}:${kind}:${new Date().toISOString().slice(0, 16)}`;
  const minute =
    await db.execute(sql`INSERT INTO ai_request_limits (bucket, used) VALUES (${bucket}, 1)
    ON CONFLICT (bucket) DO UPDATE SET used = ai_request_limits.used + 1 WHERE ai_request_limits.used < 5 RETURNING used`);
  if (!minute.rows.length)
    throw new AIError(
      "Please wait a minute before requesting more AI help.",
      429,
    );
  const daily = `${companyId}:daily:${new Date().toISOString().slice(0, 10)}`;
  const limit = Math.max(
    1,
    Math.min(1000, Number(process.env.AI_DAILY_REQUEST_LIMIT) || 100),
  );
  const day =
    await db.execute(sql`INSERT INTO ai_request_limits (bucket, used) VALUES (${daily}, 1)
    ON CONFLICT (bucket) DO UPDATE SET used = ai_request_limits.used + 1 WHERE ai_request_limits.used < ${limit} RETURNING used`);
  if (!day.rows.length)
    throw new AIError(
      "This company's daily AI allowance is used. Manual review remains available.",
      429,
    );
}
