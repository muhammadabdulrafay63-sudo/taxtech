import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { incomePolicies, salesPolicies } from "../lib/ty2025";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const errors: string[] = [];
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)
    errors.push(
      "AUTH_SECRET must be a random secret of at least 32 characters.",
    );
  if (!process.env.AUTH_URL?.startsWith("https://"))
    errors.push("Set AUTH_URL to the final HTTPS origin for deployment.");
  if (!process.env.NEBIUS_API_KEY)
    errors.push("Configure the server-side Nebius key for the AI workflow.");
  if (!process.env.MONITOR_TOKEN || process.env.MONITOR_TOKEN.length < 32)
    errors.push(
      "Configure a monitoring token of at least 32 random characters.",
    );
  const audit = JSON.parse(
    execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      encoding: "utf8",
    }),
  );
  if (audit.metadata.vulnerabilities.total)
    errors.push("Resolve runtime dependency advisories.");
  const db = neon(process.env.DATABASE_URL!);
  const users =
    await db`SELECT password_hash FROM users WHERE email NOT LIKE '%@example.invalid'`;
  let weak = 0;
  for (const user of users)
    if (
      user.password_hash &&
      (await bcrypt.compare("Admin@1234", user.password_hash))
    )
      weak++;
  if (weak)
    errors.push(
      `${weak} legacy account(s) must change their shared demo password in Settings.`,
    );
  const [schema] =
    await db`SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND ((table_name='users' AND column_name='session_version') OR (table_name='secp_obligations' AND column_name IN ('period_year','provisional','origin')))`;
  if (schema.n !== 4)
    errors.push("Apply the additive review/release database migration.");
  const [operations] =
    await db`SELECT to_regclass('public.operational_counters') IS NOT NULL AS ready`;
  if (!operations.ready)
    errors.push("Apply scripts/migrate-operations.ts before deployment.");
  const [assessment] =
    await db`SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='gl_transactions' AND column_name='tax_assessment'`;
  if (assessment.n !== 1)
    errors.push("Apply the TY2025 configuration migration before deployment.");
  const income =
    await db`SELECT rule_key,rate_filer::text,rate_non_filer::text,recipient_type FROM wht_rules WHERE active=true`;
  const sales =
    await db`SELECT rule_key,st_rate::text,wht_factor::text,authority FROM st_wht_rules WHERE active=true`;
  if (
    income.length !== Object.keys(incomePolicies).length ||
    income.some(
      (r) =>
        !incomePolicies[r.rule_key] ||
        Number(r.rate_filer) !== Number(incomePolicies[r.rule_key].rateFiler) ||
        Number(r.rate_non_filer) !==
          Number(incomePolicies[r.rule_key].rateNonFiler) ||
        r.recipient_type !== incomePolicies[r.rule_key].recipientType,
    )
  )
    errors.push(
      "Active income configuration differs from reviewed TY2025 cases.",
    );
  if (
    sales.length !== Object.keys(salesPolicies).length ||
    sales.some(
      (r) =>
        !salesPolicies[r.rule_key] ||
        Number(r.st_rate) !== Number(salesPolicies[r.rule_key].stRate) ||
        Number(r.wht_factor) !== Number(salesPolicies[r.rule_key].whtFactor) ||
        r.authority !== salesPolicies[r.rule_key].authority,
    )
  )
    errors.push(
      "Active sales-tax configuration differs from reviewed TY2025 cases.",
    );
  console.log(
    JSON.stringify(
      {
        readyForDeployment: errors.length === 0,
        errors,
        scope:
          "Code and configuration gate only. Hosted access, backups, source schedules and judge availability require operational verification.",
      },
      null,
      2,
    ),
  );
  if (errors.length) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Release check could not complete. Verify database access and dependency audit connectivity.",
  );
  process.exitCode = 1;
});
