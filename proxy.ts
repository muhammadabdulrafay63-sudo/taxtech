import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { requestAllowed } from "@/lib/request-access";

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/"))
    return NextResponse.next();
  const api = pathname.startsWith("/api/");
  if (!req.auth?.user?.id) {
    if (api)
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  const mutable = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (
    mutable &&
    req.headers.get("origin") &&
    req.headers.get("origin") !== req.nextUrl.origin
  )
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    let companyId = req.nextUrl.searchParams.get("companyId");
    if (
      mutable &&
      req.headers.get("content-type")?.includes("application/json")
    ) {
      const body = await req.clone().json();
      if (body.companyId) companyId = body.companyId;
    }
    if (
      !(await requestAllowed(req.auth.user.id, pathname, req.method, companyId))
    ) {
      return api
        ? NextResponse.json(
            { error: "You do not have access to this company or action." },
            { status: 403 },
          )
        : NextResponse.redirect(new URL("/dashboard", req.url));
    }
  } catch {
    return NextResponse.json(
      { error: "Unable to validate this request." },
      { status: 400 },
    );
  }
  return NextResponse.next();
});
export const config = {
  matcher: [
    "/((?!api/auth/|_next/static|_next/image|favicon.ico|sample-ledger.csv).*)",
  ],
};
