import { timingSafeEqual } from "node:crypto";

export function validMonitorToken(
  header: string | null,
  secret = process.env.MONITOR_TOKEN,
) {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer "))
    return false;
  const received = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
