/** First-run onboarding preference: actual session/API/layout checks, synthetic isolated users only. */
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
async function main() {
  const env = JSON.parse(await readFile("/tmp/taxtech-fresh-env.json", "utf8"));
  assert.match(
    new URL(env.DATABASE_URL).pathname.slice(1),
    /^install_[a-f0-9]+$/,
  );
  const sql = neon(env.DATABASE_URL),
    base = "http://localhost:3002",
    companyId = randomUUID();
  await sql`INSERT INTO companies(id,name) VALUES (${companyId},'Synthetic app tour verification')`;
  async function account(role: string, legacy = false) {
    const userId = randomUUID(),
      email = `tour-${randomUUID()}@example.invalid`,
      password = legacy ? "Admin@1234" : randomBytes(24).toString("base64url");
    const hash = await bcrypt.hash(password, 12);
    await sql`INSERT INTO users(id,name,email,password_hash,role,company_id) VALUES (${userId},'Tour tester',${email},${hash},${role},${companyId})`;
    async function signIn() {
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
        body: new URLSearchParams({ csrfToken, email, password }),
      });
      cookie +=
        "; " +
        login.headers
          .getSetCookie()
          .map((v) => v.split(";")[0])
          .join("; ");
      const s = await (
        await fetch(base + "/api/auth/session", { headers: { cookie } })
      ).json();
      assert.equal(s.user.id, userId);
      return cookie;
    }
    return { userId, email, password, signIn };
  }
  const owner = await account("company_admin"),
    viewer = await account("viewer"),
    legacy = await account("company_admin", true);
  async function page(cookie: string, path = "/dashboard") {
    const r = await fetch(base + path, { headers: { cookie } });
    assert.equal(r.status, 200);
    return r.text();
  }
  async function post(cookie: string, body?: object, origin = base) {
    return fetch(base + "/api/account/tour", {
      method: "POST",
      headers: {
        cookie,
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  async function seen(userId: string) {
    const [r] =
      await sql`SELECT count(*)::int n FROM audit_logs WHERE actor_id=${userId} AND action='APP_TOUR_SEEN'`;
    return r.n;
  }
  const cookie = await owner.signIn();
  assert.match(await page(cookie), /data-tour-autostart="true"/);
  assert.equal(
    (
      await fetch(base + "/api/account/tour", {
        method: "POST",
        headers: { Origin: base },
      })
    ).status,
    401,
  );
  assert.equal(
    (await post(cookie, undefined, "https://untrusted.invalid")).status,
    403,
  );
  assert.equal(await seen(owner.userId), 0);
  // Account identity comes from the session, even with another user's ID in the body.
  const responses = await Promise.all([
    post(cookie, { userId: viewer.userId }),
    post(cookie),
  ]);
  for (const r of responses) assert.equal(r.status, 200, await r.text());
  assert.equal(await seen(owner.userId), 1);
  assert.equal(await seen(viewer.userId), 0);
  assert.match(await page(cookie), /data-tour-autostart="false"/);
  const freshCookie = await owner.signIn();
  assert.match(await page(freshCookie), /data-tour-autostart="false"/);
  assert.match(
    await page(freshCookie),
    /App tour/,
    "Replay entry remains available after auto-tour is dismissed",
  );
  const viewerCookie = await viewer.signIn();
  assert.match(await page(viewerCookie), /data-tour-autostart="true"/);
  assert.equal((await post(viewerCookie)).status, 200);
  assert.equal(await seen(viewer.userId), 1);
  const denied = await fetch(base + `/api/company/${companyId}`, {
    method: "PATCH",
    headers: {
      cookie: viewerCookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Must not change" }),
  });
  assert.equal(denied.status, 403);
  const legacyCookie = await legacy.signIn();
  const settings = await page(legacyCookie, `/company/${companyId}/settings`);
  assert.ok(!settings.includes('data-tour-autostart="true"'));
  assert.equal((await post(legacyCookie)).status, 403);
  assert.equal(await seen(legacy.userId), 0);
  const result = {
    passed: true,
    firstVisitAutoTour: true,
    persistsAcrossFreshSessions: true,
    idempotentConcurrentWrites: true,
    separateUserPreferences: true,
    viewerAllowedWithoutWriteEscalation: true,
    legacyPasswordChangeFirst: true,
    foreignOriginAndAnonymousBlocked: true,
  };
  console.log(JSON.stringify(result));
  await writeFile(
    "/tmp/taxtech-app-tour-results.json",
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
  await writeFile(
    "/tmp/taxtech-app-tour-browser.json",
    JSON.stringify({
      companyId,
      userId: viewer.userId,
      email: viewer.email,
      password: viewer.password,
    }),
    { mode: 0o600 },
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
