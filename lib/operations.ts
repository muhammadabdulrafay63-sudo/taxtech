import { db } from "@/db";
import { sql } from "drizzle-orm";
// Store only aggregate counters. Never persist exception text, URLs, prompts or client data.
export async function recordOperationalEvent(
  kind: "server_error" | "ai_error" | "ai_success",
) {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.execute(sql`INSERT INTO operational_counters (minute, kind, count)
      VALUES (date_trunc('minute', now()), ${kind}, 1)
      ON CONFLICT (minute, kind) DO UPDATE SET count = operational_counters.count + 1`);
  } catch {
    console.error("Operational counter unavailable");
  }
}
