/** Regression: both approval/rule-edit orderings, both tax lanes, and audit rollback. Isolated install_* only. */
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
    base = "http://localhost:3002";
  async function account(role: string) {
    const companyId = randomUUID(),
      email = `race-${randomUUID()}@example.invalid`,
      password = randomBytes(24).toString("base64url");
    const hash = await bcrypt.hash(password, 12);
    await sql.transaction([
      sql`INSERT INTO companies(id,name) VALUES (${companyId},'Synthetic rule concurrency audit')`,
      sql`INSERT INTO users(name,email,password_hash,role,company_id) VALUES ('Concurrency audit',${email},${hash},${role},${companyId})`,
    ]);
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
    const session = await (
      await fetch(base + "/api/auth/session", { headers: { cookie } })
    ).json();
    assert.equal(session.user?.email, email);
    return {
      companyId,
      async req(path: string, body?: unknown, method = "POST") {
        const r = await fetch(base + path, {
          method,
          headers: {
            cookie,
            Origin: base,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: r.status, data: await r.json() };
      },
    };
  }
  const admin = await account("superadmin");
  const observations: object[] = [];
  async function waitFor(query: () => Promise<boolean>, message: string) {
    for (let i = 0; i < 40; i++) {
      if (await query()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw Error(message);
  }
  async function barrier(table: string, condition: string) {
    const fn = "audit_race_" + randomUUID().replaceAll("-", ""),
      key = randomBytes(4).readUInt32BE() % 1000000000;
    await sql.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN PERFORM pg_advisory_xact_lock(2147483000,${key}); PERFORM pg_sleep(15); END IF; RETURN NEW; END $$`,
    );
    await sql.query(
      `CREATE TRIGGER ${fn} BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
    );
    return {
      async reached() {
        await waitFor(async () => {
          const [r] =
            await sql`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=2147483000 AND objid=${key} AND granted) AS ok`;
          return r.ok;
        }, "Controlled update barrier not reached");
      },
      async remove() {
        await sql.query(`DROP TRIGGER IF EXISTS ${fn} ON ${table}`);
        await sql.query(`DROP FUNCTION IF EXISTS ${fn}()`);
      },
    };
  }
  async function waiting(table: string, mode: string) {
    await waitFor(async () => {
      const [r] =
        await sql`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE relation=${table}::regclass AND mode=${mode} AND NOT granted) AS ok`;
      return r.ok;
    }, `Expected ${mode} wait on ${table}`);
  }
  for (const kind of ["income", "sales"] as const) {
    const user = await account("company_admin");
    const [vendor] =
      await sql`INSERT INTO vendors(company_id,name,recipient_type,recipient_type_verified_at,is_filer,is_st_registered) VALUES (${user.companyId},'Synthetic verified supplier','company',now(),true,true) RETURNING id`;
    const income = kind === "income",
      ruleTable = income ? "wht_rules" : "st_wht_rules",
      batchTable = income ? "wht_batches" : "st_wht_batches";
    const ruleKey = income ? "153_goods_company" : "fbr_goods_registered",
      rateColumn = income ? "rate_filer" : "st_rate";
    const lane = income ? "wht" : "st-wht",
      action = income ? "APPROVE_BATCH" : "APPROVE_ST_WHT_BATCH";
    const [original] = await sql.query(
      `SELECT * FROM ${ruleTable} WHERE rule_key=$1`,
      [ruleKey],
    );
    const oldRate = Number(original[rateColumn]),
      newRate = oldRate === 7 ? 6 : 7;
    const expected = (rate: number) =>
      income
        ? 1000 * rate
        : Math.round(1000 * rate * Number(original.wht_factor) * 100) / 100;
    async function fixture(month: number) {
      const [txn] =
        await sql`INSERT INTO gl_transactions(company_id,txn_date,description,amount,debit,vendor_id,review_status) VALUES (${user.companyId},${`2025-0${month}-01`},'Synthetic concurrent rule test',100000,100000,${vendor.id},'pending') RETURNING id`;
      assert.equal(
        (
          await user.req("/api/transactions/review", {
            id: txn.id,
            decision: "approved",
            ruleKey: income ? ruleKey : null,
            stRuleKey: income ? null : ruleKey,
            note: "Synthetic evidence verified.",
          })
        ).status,
        200,
      );
      await recalc(month);
      const [batch] = await sql.query(
        `SELECT id,total_wht FROM ${batchTable} WHERE company_id=$1 AND year=2025 AND month=$2`,
        [user.companyId, month],
      );
      assert.equal(Number(batch.total_wht), expected(oldRate));
      return batch.id as string;
    }
    async function recalc(month: number) {
      const r = await user.req(`/api/${lane}/calc`, {
        companyId: user.companyId,
        year: 2025,
        month,
      });
      assert.equal(r.status, 200, JSON.stringify(r));
    }
    async function batch(id: string) {
      return (
        await sql.query(
          `SELECT status,total_wht FROM ${batchTable} WHERE id=$1`,
          [id],
        )
      )[0];
    }
    async function audits(id: string) {
      const [r] =
        await sql`SELECT count(*)::int n FROM audit_logs WHERE entity_id=${id} AND action=${action}`;
      return r.n;
    }
    async function restore() {
      await sql.query(
        `UPDATE ${ruleTable} SET ${rateColumn}=$1,updated_at=$2 WHERE id=$3`,
        [original[rateColumn], original.updated_at, original.id],
      );
    }
    // Approval owns the rule-table lock first: the actual admin API waits until approval commits.
    const firstId = await fixture(1);
    const first = await barrier(
      batchTable,
      `NEW.id = '${firstId}'::uuid AND NEW.status='approved'`,
    );
    let approval: ReturnType<typeof user.req> | undefined,
      edit: ReturnType<typeof admin.req> | undefined;
    try {
      approval = user.req(`/api/${lane}/batch/${firstId}/approve`);
      await first.reached();
      edit = admin.req(
        `/api/admin/${income ? "rules" : "st-rules"}/${original.id}`,
        income ? { rateFiler: newRate } : { stRate: newRate },
        "PATCH",
      );
      await waiting(ruleTable, "RowExclusiveLock");
      const [during] = await sql.query(
        `SELECT ${rateColumn} rate FROM ${ruleTable} WHERE id=$1`,
        [original.id],
      );
      assert.equal(
        Number(during.rate),
        oldRate,
        "Rule cannot commit during approval",
      );
      const [approved, changed] = await Promise.all([approval, edit]);
      assert.equal(approved.status, 200, JSON.stringify(approved));
      assert.equal(changed.status, 200, JSON.stringify(changed));
      const final = await batch(firstId);
      assert.equal(final.status, "approved");
      assert.equal(Number(final.total_wht), expected(oldRate));
      assert.equal(await audits(firstId), 1);
      observations.push({
        kind,
        case: "Approval first: admin edit waits for commit",
        safe: true,
        totalWht: final.total_wht,
      });
      console.log(JSON.stringify(observations.at(-1)));
    } finally {
      await Promise.allSettled([approval, edit].filter(Boolean));
      await first.remove();
      await restore();
    }
    // A direct database edit owns the lock first, without an audit event. The
    // approval precheck sees old committed data; its final fingerprint must reject.
    const secondId = await fixture(2);
    const second = await barrier(ruleTable, `NEW.id = ${Number(original.id)}`);
    let direct: Promise<unknown> | undefined;
    approval = undefined;
    try {
      direct = (async () =>
        await sql.query(
          `UPDATE ${ruleTable} SET ${rateColumn}=$1,updated_at=clock_timestamp() WHERE id=$2`,
          [newRate, original.id],
        ))();
      await second.reached();
      approval = user.req(`/api/${lane}/batch/${secondId}/approve`);
      await waiting(ruleTable, "ShareLock");
      await direct;
      const denied = await approval;
      assert.equal(denied.status, 409, JSON.stringify(denied));
      const stale = await batch(secondId);
      assert.equal(stale.status, "draft");
      assert.equal(await audits(secondId), 0);
      await second.remove();
      await recalc(2);
      const [revised] = await sql.query(
        `SELECT id,total_wht FROM ${batchTable} WHERE company_id=$1 AND year=2025 AND month=2`,
        [user.companyId],
      );
      assert.equal(Number(revised.total_wht), expected(newRate));
      observations.push({
        kind,
        case: "Edit first without audit: stale approval rejected",
        safe: true,
        status: denied.status,
        recalculatedTax: revised.total_wht,
      });
      console.log(JSON.stringify(observations.at(-1)));
      // Approval and audit remain atomic under an audit-write failure.
      const fault = "audit_fault_" + randomUUID().replaceAll("-", "");
      try {
        await sql.query(
          `CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='${revised.id}' AND NEW.action='${action}' THEN RAISE EXCEPTION 'Synthetic approval audit outage'; END IF; RETURN NEW; END $$`,
        );
        await sql.query(
          `CREATE TRIGGER ${fault} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ${fault}()`,
        );
        const failed = await user.req(
          `/api/${lane}/batch/${revised.id}/approve`,
        );
        assert.equal(failed.status, 500, JSON.stringify(failed));
        assert.equal((await batch(revised.id)).status, "draft");
        assert.equal(await audits(revised.id), 0);
      } finally {
        await sql.query(`DROP TRIGGER IF EXISTS ${fault} ON audit_logs`);
        await sql.query(`DROP FUNCTION IF EXISTS ${fault}()`);
      }
      const retry = await user.req(`/api/${lane}/batch/${revised.id}/approve`);
      assert.equal(retry.status, 200, JSON.stringify(retry));
      assert.equal(await audits(revised.id), 1);
      observations.push({
        kind,
        case: "Audit outage rolls back; retry approves recalculated tax",
        safe: true,
        totalWht: (await batch(revised.id)).total_wht,
      });
      console.log(JSON.stringify(observations.at(-1)));
    } finally {
      await Promise.allSettled([approval, direct].filter(Boolean));
      await second.remove();
      await restore();
    }
  }
  await writeFile(
    "/tmp/taxtech-round5-fixed-concurrency.json",
    JSON.stringify({ passed: true, observations }, null, 2),
    { mode: 0o600 },
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
