import { auth } from "@/auth";
import { requestAllowed } from "./request-access";
import { NextResponse } from "next/server";

/** Defense in depth: each API handler authorizes independently of Next's proxy. */
export async function guardRoute(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const url = new URL(req.url);
  if (
    (session.user as { mustChangePassword?: boolean }).mustChangePassword &&
    url.pathname !== "/api/account/password"
  )
    return NextResponse.json(
      {
        error:
          "Change the legacy password in Settings before using this account.",
      },
      { status: 403 },
    );
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.get("origin") &&
    req.headers.get("origin") !== url.origin
  )
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    let company = url.searchParams.get("companyId");
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.clone().json();
      company = body.companyId ?? company;
    }
    if (
      !(await requestAllowed(
        session.user.id,
        url.pathname,
        req.method,
        company,
      ))
    )
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  return null;
}
