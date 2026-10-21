import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async () => {
  const { recordOperationalEvent } = await import("@/lib/operations");
  await recordOperationalEvent("server_error");
};
