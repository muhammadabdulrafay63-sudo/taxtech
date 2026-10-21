import { db } from "@/db";
import { sql } from "drizzle-orm";
import { validMonitorToken } from "@/lib/monitor-auth";
import { NextResponse } from "next/server";
import { judgeDemoHealth } from "@/lib/judge-demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!validMonitorToken(req.headers.get("authorization")))
    return NextResponse.json({ status: "alive" }, { headers });
  try {
    if (new URL(req.url).searchParams.get("probe") === "ai") {
      const provider = await fetch(
        "https://api.tokenfactory.nebius.com/v1/chat/completions",
        {
          method: "POST",
          signal: AbortSignal.timeout(45000),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${process.env.NEBIUS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model:
              process.env.NEBIUS_MODEL ||
              "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
            max_tokens: 8,
            chat_template_kwargs: { enable_thinking: false },
            messages: [{ role: "user", content: "Reply OK." }],
          }),
        },
      );
      if (!provider.ok)
        return NextResponse.json(
          { status: "ai_unavailable" },
          { status: 503, headers },
        );
    }
    const result = await db.execute(sql`SELECT
      (SELECT coalesce(sum(count),0)::int FROM operational_counters WHERE minute > now() - interval '20 minutes' AND kind='server_error') AS server_errors,
      (SELECT coalesce(sum(count),0)::int FROM operational_counters WHERE minute > now() - interval '20 minutes' AND kind='ai_error') AS ai_errors,
      (SELECT coalesce(sum(used),0)::int FROM ai_request_limits WHERE bucket = 'global:daily:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')) AS ai_requests`);
    const metrics = result.rows[0];
    return NextResponse.json(
      {
        status: "ready",
        ...metrics,
        ai_daily_limit: Math.max(
          1,
          Math.min(
            10000,
            Number(process.env.AI_GLOBAL_DAILY_REQUEST_LIMIT) || 500,
          ),
        ),
        ai_configured: !!process.env.NEBIUS_API_KEY,
        judge_demo: await judgeDemoHealth(),
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers },
    );
  }
}
