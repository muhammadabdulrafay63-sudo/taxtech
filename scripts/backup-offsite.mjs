import {
  mkdtemp,
  readFile,
  writeFile,
  stat,
  rm,
  mkdir,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// pg_dump authenticates via child environment, never a URL/password in command arguments.
function run(command, args, env) {
  return new Promise((res, rej) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (c) => {
      output += c;
    });
    child.stderr.resume(); // Provider diagnostics can contain sensitive identifiers.
    child.on("error", () => rej(new Error(`${command} could not start`)));
    child.on("close", (code) =>
      code === 0
        ? res(output)
        : rej(
            new Error(
              `${command} failed; inspect connectivity and permissions privately`,
            ),
          ),
    );
  });
}
const countsQuery = `SELECT json_object_agg(tablename, total ORDER BY tablename)::text FROM
  (SELECT c.relname AS tablename, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I',c.relname),false,true,'')))[1]::text AS total
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') s`;
const url = new URL(process.env.BACKUP_DATABASE_URL);
assert.ok(
  process.env.BACKUP_RECIPIENT?.startsWith("age1"),
  "Missing backup encryption recipient",
);
const output = resolve(process.env.BACKUP_OUTPUT_DIR || "backup-output");
const work = await mkdtemp(join(tmpdir(), "taxtech-backup-"));
const pgEnv = {
  PGHOST: url.hostname.replace("-pooler.", "."),
  PGPORT: url.port || "5432",
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGSSLMODE: "require",
};
const docker = (command, args, env = pgEnv) =>
  run(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "host",
      "-v",
      `${work}:/backup`,
      ...Object.keys(env).flatMap((k) => ["-e", k]),
      "postgres:18",
      command,
      ...args,
    ],
    env,
  );
try {
  // A consistent custom-format snapshot. Source role has SELECT only.
  await docker("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--file",
    "/backup/database.dump",
  ]);
  const dump = join(work, "database.dump");
  assert.ok((await stat(dump)).size > 100, "Backup was empty");
  // Verify every backup can restore into the runner's disposable Postgres, before upload.
  const restoreEnv = {
    PGHOST: "127.0.0.1",
    PGPORT: "5432",
    PGDATABASE: "restore_check",
    PGUSER: "postgres",
    PGPASSWORD: process.env.RESTORE_PASSWORD,
    PGSSLMODE: "disable",
  };
  assert.ok(restoreEnv.PGPASSWORD, "Missing isolated restore password");
  await docker(
    "pg_restore",
    [
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      "--dbname",
      "restore_check",
      "/backup/database.dump",
    ],
    restoreEnv,
  );
  const restored = await docker(
    "psql",
    ["-XAt", "-c", countsQuery],
    restoreEnv,
  );
  assert.ok(
    Object.keys(JSON.parse(restored)).length > 10,
    "Restore did not contain the application tables",
  );
  await mkdir(output, { recursive: true, mode: 0o700 });
  const name = `taxtech-${new Date().toISOString().replaceAll(":", "-")}.dump.age`;
  await run("age", [
    "--recipient",
    process.env.BACKUP_RECIPIENT,
    "--output",
    join(output, name),
    dump,
  ]);
  const encrypted = await readFile(join(output, name));
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify(
      {
        format: "pg18-custom+age",
        createdAt: new Date().toISOString(),
        file: name,
        sha256: createHash("sha256").update(encrypted).digest("hex"),
        restoreVerified: true,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    "Encrypted backup created; isolated PostgreSQL 18 restore passed. No client records were logged.",
  );
} finally {
  await rm(work, { recursive: true, force: true });
}
