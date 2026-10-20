/** Create a company account without shipping a shared default password. */
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters in .env.local.",
    );
  const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
  if (
    (
      await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1)
    ).length
  ) {
    console.log(
      "Account already exists; its password and records were not changed.",
    );
    return;
  }
  const companyId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.batch([
    db.insert(schema.companies).values({
      id: companyId,
      name: process.env.COMPANY_NAME || "Demo company",
    }),
    db.insert(schema.users).values({
      email,
      name: process.env.ADMIN_NAME || "Accountant",
      passwordHash,
      role: "superadmin",
      companyId,
    }),
  ]);
  console.log(
    "Company and account created. Sign in using the credentials you configured.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
