import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Use the configured canonical origin (or Vercel's managed proxy). Explicit
  // detection avoids empty optional platform variables masking host trust.
  trustHost: Boolean(
    process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.VERCEL === "1",
  ),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.companyId = (user as { companyId?: string }).companyId;
        token.sessionVersion = (
          user as { sessionVersion?: number }
        ).sessionVersion;
        token.mustChangePassword = (
          user as { mustChangePassword?: boolean }
        ).mustChangePassword;
      }
      if (!user && token.id) {
        const [current] = await db
          .select({
            role: users.role,
            companyId: users.companyId,
            sessionVersion: users.sessionVersion,
          })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        if (!current || token.sessionVersion !== current.sessionVersion)
          return null;
        token.role = current.role;
        token.companyId = current.companyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { mustChangePassword?: boolean }).mustChangePassword =
          !!token.mustChangePassword;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { companyId?: string }).companyId =
          token.companyId as string;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const bucket = `login:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}:${Math.floor(Date.now() / 900000)}`;
        const limit = await db.execute(
          sql`INSERT INTO ai_request_limits(bucket,used) VALUES (${bucket},1) ON CONFLICT(bucket) DO UPDATE SET used=ai_request_limits.used+1 WHERE ai_request_limits.used<10 RETURNING used`,
        );
        if (!limit.rows.length) return null;
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          sessionVersion: user.sessionVersion,
          mustChangePassword: password.length < 12 || password === "Admin@1234",
        };
      },
    }),
  ],
});
