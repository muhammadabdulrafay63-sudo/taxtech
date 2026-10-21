import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE TABLE IF NOT EXISTS operational_counters (
  minute timestamptz NOT NULL, kind text NOT NULL, count integer NOT NULL DEFAULT 1,
  UNIQUE (minute, kind))`;
  console.log("Operational counters ready.");
}
main().catch(() => {
  console.error(
    "Operational migration failed; check the administrative connection privately.",
  );
  process.exitCode = 1;
});
