import test from "node:test";
import assert from "node:assert/strict";
import { validMonitorToken } from "../lib/monitor-auth";

test("operational metrics require an exact, sufficiently long bearer secret", () => {
  const secret = "a".repeat(48);
  assert.equal(validMonitorToken(`Bearer ${secret}`, secret), true);
  for (const value of [
    null,
    "",
    secret,
    `Bearer ${secret}x`,
    `Bearer ${"b".repeat(48)}`,
    "Bearer short",
  ])
    assert.equal(validMonitorToken(value, secret), false);
  assert.equal(validMonitorToken("Bearer short", "short"), false);
  assert.equal(validMonitorToken(`Bearer ${secret}`, ""), false);
});
