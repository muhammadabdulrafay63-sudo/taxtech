/** Only explicit, invoice-based historical cases; no blanket provincial defaults. */
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { stWhtRules } from "./schema";
import { salesPolicies } from "../lib/ty2025";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));
  await db
    .insert(stWhtRules)
    .values(
      Object.entries(salesPolicies).map(([ruleKey, p]) => ({
        ruleKey,
        authority: p.authority,
        province: p.province,
        description: p.description,
        stRate: p.stRate,
        whtFactor: p.whtFactor,
        category: "reviewed_case",
        appliesTo: "registered",
        notes: p.notes,
        active: true,
      })),
    )
    .onConflictDoNothing({ target: stWhtRules.ruleKey });
  console.log(
    `Seeded ${Object.keys(salesPolicies).length} reviewed TY2025 sales-tax cases.`,
  );
}
main().catch(() => {
  console.error("Sales seed failed. Verify the database connection privately.");
  process.exitCode = 1;
});
