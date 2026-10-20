import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
async function main() {
  const fresh = JSON.parse(
    await readFile("/tmp/taxtech-fresh-env.json", "utf8"),
  );
  const child = spawn("npx", ["tsx", "tests/workflow.integration.ts"], {
    env: {
      ...process.env,
      DATABASE_URL: fresh.DATABASE_URL,
      AUTH_URL: fresh.AUTH_URL,
      TEST_BASE_URL: "http://localhost:3002",
    },
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
main().catch(() => {
  console.error("Run the fresh-install test and start its isolated app first.");
  process.exitCode = 1;
});
