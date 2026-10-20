import dotenv from "dotenv";
import { spawn } from "node:child_process";
import { chmod, mkdir, stat, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const path = resolve(
    process.env.BACKUP_PATH ??
      `.backups/taxtech-${new Date().toISOString().replaceAll(":", "-")}.dump`,
  );
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const destination = await open(path, "wx", 0o600);
  await destination.close();
  const env = {
    ...process.env,
    PGHOST: url.hostname.replace("-pooler.", "."),
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: "require",
  };
  const child = spawn(
    process.env.PG_DUMP_BIN ?? "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl", "--file", path],
    { env, stdio: ["ignore", "ignore", "pipe"] },
  );
  const code = await new Promise<number | null>((res, rej) => {
    child.on("error", rej);
    child.on("exit", res);
  });
  if (code !== 0)
    throw new Error(
      "Database backup failed. Check connectivity and the pg_dump version.",
    );
  await chmod(path, 0o600);
  if ((await stat(path)).size < 100)
    throw new Error("Backup file is unexpectedly empty.");
  console.log(`Private backup saved: ${path}`);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
