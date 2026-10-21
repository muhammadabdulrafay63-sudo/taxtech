import assert from "node:assert/strict";
const base = new URL(process.env.APP_URL);
assert.equal(base.protocol, "https:");
const token = process.env.MONITOR_TOKEN;
assert.ok(token?.length >= 32, "Missing monitoring credential");
async function check(path, options = {}) {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    signal: AbortSignal.timeout(60000),
    ...options,
  });
  assert.equal(response.status, 200, `Service check failed: ${path}`);
  return response;
}
await check("/login");
await check("/api/auth/csrf");
const response = await check(
  process.env.CHECK_AI === "true" ? "/api/health?probe=ai" : "/api/health",
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
const health = await response.json();
assert.equal(health.status, "ready", "Database readiness check failed");
assert.equal(health.ai_configured, true, "AI configuration missing");
assert.equal(
  health.judge_demo?.available,
  true,
  "Judge account changed or unavailable; check its dedicated access details",
);
assert.equal(
  health.judge_demo?.prepared_ready,
  true,
  "Prepared judge example is missing or changed",
);
assert.equal(
  health.server_errors,
  0,
  "Server exceptions recorded in last 20 minutes",
);
assert.equal(
  health.ai_errors,
  0,
  "AI provider errors recorded in last 20 minutes",
);
assert.ok(
  health.ai_requests < health.ai_daily_limit * 0.8,
  "AI requests reached 80% of daily allowance; check Nebius credit balance",
);
console.log(
  "Website, authentication, database, server errors and AI quota checks passed.",
);
