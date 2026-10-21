import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { applyTY2025Configuration } from "./ty2025-config";
dotenv.config({
  path: process.env.TAXTECH_ENV_FILE || ".env.local",
  quiet: true,
});
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Database connection required.");
  await applyTY2025Configuration(neon(process.env.DATABASE_URL));
  console.log(
    "TY2025 configuration applied; historical financial records preserved.",
  );
}
main().catch(() => {
  console.error(
    "TY2025 configuration migration failed. Inspect the administrative connection and migration preconditions privately.",
  );
  process.exitCode = 1;
});
