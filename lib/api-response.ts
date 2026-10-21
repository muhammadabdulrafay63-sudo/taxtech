import { NextResponse } from "next/server";
import { recordOperationalEvent } from "./operations";

/** Include handled API 5xx failures in alerts without collecting response bodies. */
export async function apiJSON<T>(
  body: T,
  init?: ResponseInit,
) {
  if (init?.status && init.status >= 500)
    await recordOperationalEvent("server_error");
  return NextResponse.json<T>(body, init);
}
