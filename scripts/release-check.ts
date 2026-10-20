import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
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
