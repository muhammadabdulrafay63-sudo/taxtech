import { guardRoute } from "@/lib/route-guard";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { NextResponse } from "next/server";
const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(12)
    .max(72)
    .refine((v) => !["Admin@1234", "password1234", "Password1234"].includes(v)),
});
export async function POST(req: Request) {
  const denied = await guardRoute(req);
  if (denied) return denied;
  const session = await auth();
  const input = schema.safeParse(await req.json());
  if (!input.success)
    return NextResponse.json(
      { error: "Use a unique password of 12–72 characters." },
      { status: 400 },
    );
  const id = session!.user!.id!;
  const companyId = (session!.user as { companyId: string }).companyId;
  const bucket = `password:${id}:${Math.floor(Date.now() / 900000)}`;
  const limit = await db.execute(
    sql`INSERT INTO ai_request_limits(bucket,used) VALUES (${bucket},1) ON CONFLICT(bucket) DO UPDATE SET used=ai_request_limits.used+1 WHERE ai_request_limits.used<5 RETURNING used`,
  );
  if (!limit.rows.length)
    return NextResponse.json(
      { error: "Please wait before trying again." },
      { status: 429 },
    );
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (
    !user?.passwordHash ||
    !(await bcrypt.compare(input.data.currentPassword, user.passwordHash))
  )
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );
  if (input.data.currentPassword === input.data.newPassword)
    return NextResponse.json(
      { error: "Choose a different password." },
      { status: 400 },
    );
  const hash = await bcrypt.hash(input.data.newPassword, 12);
  await db.batch([
    db
      .update(users)
      .set({ passwordHash: hash, sessionVersion: user.sessionVersion + 1 })
      .where(
        and(eq(users.id, id), eq(users.sessionVersion, user.sessionVersion)),
      ),
    db
      .insert(auditLogs)
      .values({
        companyId,
        actorId: id,
        action: "CHANGE_PASSWORD",
        entityType: "user",
        entityId: id,
      }),
  ]);
  return NextResponse.json({ ok: true, signInRequired: true });
}
