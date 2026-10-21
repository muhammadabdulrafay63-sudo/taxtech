/** Fresh-install seed; existing rules require the explicit TY2025 migration. */
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { whtRules } from "./schema";
import { incomePolicies } from "../lib/ty2025";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));
  await db
    .insert(whtRules)
    .values(
      Object.entries(incomePolicies).map(([ruleKey, p]) => ({
        ruleKey,
        ...p,
        thresholdAmount: "0",
        isTiered: false,
        usesSlabRates: false,
        active: true,
      })),
    )
    .onConflictDoNothing({ target: whtRules.ruleKey });
  console.log(
    `Seeded ${Object.keys(incomePolicies).length} reviewed TY2025 income cases.`,
  );
}
main().catch(() => {
  console.error(
    "Income seed failed. Verify the database connection privately.",
  );
  process.exitCode = 1;
});
