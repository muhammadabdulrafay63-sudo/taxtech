/** Creates an isolated empty database; never drops or edits existing databases/tables. */
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const schema = "install_" + randomUUID().replaceAll("-", "");
  const sql = neon(process.env.DATABASE_URL!);
  const ddl = execFileSync(
    "npx",
    [
      "drizzle-kit",
      "export",
      "--dialect=postgresql",
      "--schema=./db/schema.ts",
    ],
    { encoding: "utf8" },
  );
  if (!ddl.startsWith("CREATE TABLE"))
    throw new Error("Unexpected schema export.");
  await sql.query(`CREATE DATABASE "${schema}"`);
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/" + schema;
  url.searchParams.delete("options");
  const isolated = neon(url.toString());
  const statements = ddl
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await isolated.transaction(statements.map((s) => isolated.query(s)));
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    ADMIN_EMAIL: `install-${schema}@example.invalid`,
    ADMIN_PASSWORD: randomUUID() + randomUUID(),
    AUTH_URL: "http://localhost:3002",
  };
  for (const script of ["db/seed.ts", "db/seed-st.ts", "db/create-admin.ts"])
    execFileSync("npx", ["tsx", script], { env, stdio: "pipe" });
  const [before] =
    await isolated`SELECT (SELECT count(*) FROM wht_rules)::int AS income,(SELECT count(*) FROM st_wht_rules)::int AS sales,(SELECT count(*) FROM users)::int AS users`;
  for (const script of ["db/seed.ts", "db/seed-st.ts"])
    execFileSync("npx", ["tsx", script], { env, stdio: "pipe" });
  const [after] =
    await isolated`SELECT (SELECT count(*) FROM wht_rules)::int AS income,(SELECT count(*) FROM st_wht_rules)::int AS sales,(SELECT count(*) FROM users)::int AS users`;
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error("Seed idempotence failed.");
  await writeFile(
    "/tmp/taxtech-fresh-env.json",
    JSON.stringify({
      DATABASE_URL: url.toString(),
      AUTH_URL: env.AUTH_URL,
      schema,
    }),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({ schema, counts: after, setupAndRepeatSeedPassed: true }),
  );
}
main().catch((e) => {
  console.error(
    "Fresh-install test failed:",
    String(e.message).replace(
      /postgres(?:ql)?:\/\/[^\s]+/gi,
      "[database URL redacted]",
    ),
  );
  process.exitCode = 1;
});
