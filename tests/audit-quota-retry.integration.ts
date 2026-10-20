/** Focused audit retry: reserve adjacent minute buckets for the existing synthetic audit user. */
import { readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import assert from "node:assert/strict";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const a = JSON.parse(
    await readFile("/tmp/taxtech-audit-account.json", "utf8"),
  );
  assert.ok(
    a.email.endsWith("@example.invalid"),
    "Synthetic audit account only",
  );
  const sql = neon(process.env.DATABASE_URL!),
    base = "http://localhost:3000";
  const csrf = await fetch(base + "/api/auth/csrf"),
    { csrfToken } = await csrf.json();
  let cookie = csrf.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const login = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie,
      Origin: base,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      csrfToken,
      email: a.email,
      password: a.password,
    }),
  });
  cookie +=
    "; " +
    login.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
  const session = await (
    await fetch(base + "/api/auth/session", { headers: { cookie } })
  ).json();
  assert.equal(session.user.id, a.userId);
  const now = Date.now();
  for (const offset of [0, 60000]) {
    const bucket = `${a.userId}:assistant:${new Date(now + offset).toISOString().slice(0, 16)}`;
    await sql`INSERT INTO ai_request_limits(bucket,used) VALUES (${bucket},5) ON CONFLICT(bucket) DO UPDATE SET used=5`;
  }
  const res = await fetch(base + "/api/ai/assistant", {
    method: "POST",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      pathname: "/dashboard",
      question: "How do I upload?",
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 429, JSON.stringify(data));
  assert.match(data.error, /wait a minute/i);
  const result = {
    passed: true,
    status: res.status,
    error: data.error,
    adjacentMinuteFixture: true,
  };
  console.log(JSON.stringify(result));
  await writeFile(
    "/tmp/taxtech-round8-quota-retry.json",
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
