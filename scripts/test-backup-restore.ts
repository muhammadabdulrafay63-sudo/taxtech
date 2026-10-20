/** Round-trip only the isolated fresh-install database, never the user's business database. */
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
async function main() {
  const fresh = JSON.parse(
    await readFile("/tmp/taxtech-fresh-env.json", "utf8"),
  );
  const url = new URL(fresh.DATABASE_URL);
  if (!/^install_[a-f0-9]+$/.test(url.pathname.slice(1)))
    throw new Error("Use only the isolated installation fixture.");
  const source = neon(url.toString());
  const name = "restore_" + crypto.randomUUID().replaceAll("-", "");
  await source.query(`CREATE DATABASE "${name}"`);
  const path = `/tmp/taxtech-audit/${name}.dump`;
  execFileSync("npx", ["tsx", "scripts/backup.ts"], {
    env: { ...process.env, DATABASE_URL: url.toString(), BACKUP_PATH: path },
    stdio: "pipe",
  });
  const env = {
    ...process.env,
    PGHOST: url.hostname.replace("-pooler.", "."),
    PGPORT: url.port || "5432",
    PGDATABASE: name,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: "require",
  };
  execFileSync(
    "pg_restore",
    ["--no-owner", "--no-acl", "--exit-on-error", "--dbname", name, path],
    { env, stdio: "pipe" },
  );
  url.pathname = "/" + name;
  const restored = neon(url.toString());
  const query =
    "SELECT (SELECT count(*) FROM public.companies)::int companies,(SELECT count(*) FROM public.users)::int users,(SELECT count(*) FROM public.gl_transactions)::int transactions,(SELECT count(*) FROM public.wht_batches)::int batches,(SELECT count(*) FROM public.audit_logs)::int audits";
  const a = await source.query(query),
    b = await restored.query(query);
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error("Restored counts differ from source.");
  console.log(JSON.stringify({ backupRestorePassed: true, counts: b[0] }));
}
main().catch((e) => {
  console.error(
    "Isolated backup/restore test failed:",
    String(e.stderr ?? e.message)
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted]")
      .slice(0, 1800),
  );
  process.exitCode = 1;
});
