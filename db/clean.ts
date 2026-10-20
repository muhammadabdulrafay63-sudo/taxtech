/**
 * Clears all transactional data but keeps companies, users, and wht_rules.
 * Run: npx tsx db/clean.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

const _sql = neon(process.env.DATABASE_URL!);
const db = drizzle(_sql, { schema });

async function main() {
  if(process.env.ALLOW_DESTRUCTIVE_RESET!=="DELETE_ALL_TRANSACTIONAL_DATA"||process.env.NODE_ENV==="production")throw new Error("Reset is disabled. Use only an explicitly disposable development database and ALLOW_DESTRUCTIVE_RESET=DELETE_ALL_TRANSACTIONAL_DATA.");
  console.log("Cleaning transactional data...");

  // Order matters — delete children before parents
  await db.execute(sql`TRUNCATE TABLE wht_batch_items CASCADE`);
  await db.execute(sql`TRUNCATE TABLE challan_records CASCADE`);
  await db.execute(sql`TRUNCATE TABLE wht_batches CASCADE`);
  await db.execute(sql`TRUNCATE TABLE wht_lines CASCADE`);
  await db.execute(sql`TRUNCATE TABLE st_wht_batch_items CASCADE`);
  await db.execute(sql`TRUNCATE TABLE st_wht_batches CASCADE`);
  await db.execute(sql`TRUNCATE TABLE st_wht_lines CASCADE`);
  await db.execute(sql`TRUNCATE TABLE salary_wht_lines CASCADE`);
  await db.execute(sql`TRUNCATE TABLE gl_transaction_splits CASCADE`);
  await db.execute(sql`TRUNCATE TABLE gl_transactions CASCADE`);
  await db.execute(sql`TRUNCATE TABLE company_account_mappings CASCADE`);
  await db.execute(sql`TRUNCATE TABLE vendors CASCADE`);
  await db.execute(sql`TRUNCATE TABLE audit_logs CASCADE`);
  await db.execute(sql`TRUNCATE TABLE secp_obligations CASCADE`);
  await db.execute(sql`TRUNCATE TABLE secp_companies CASCADE`);
  await db.execute(sql`TRUNCATE TABLE employees CASCADE`);

  console.log("✓ Done — companies, users, WHT rules, and ST WHT rules are untouched.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
