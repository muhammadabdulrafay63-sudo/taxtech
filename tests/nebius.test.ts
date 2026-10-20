import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { completeJSON } from "../lib/ai/nebius";
test("provider request is NVIDIA on Nebius; malformed responses and provider failures are explicit", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.NEBIUS_API_KEY;
  const oldModel = process.env.NEBIUS_MODEL;
  process.env.NEBIUS_API_KEY = "test-key";
  delete process.env.NEBIUS_MODEL;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(
        String(url),
        "https://api.tokenfactory.nebius.com/v1/chat/completions",
      );
      const body = JSON.parse(String(init?.body));
      assert.match(body.model, /^nvidia\//);
      assert.equal(body.max_tokens, 6000);
      assert.equal(body.chat_template_kwargs.enable_thinking, false);
      return Response.json({
        choices: [{ message: { content: '{"answer":"Ready"}' } }],
      });
    };
    assert.equal(
      (
        await completeJSON(
          "Help",
          { question: "test" },
          z.object({ answer: z.string() }),
        )
      ).result.answer,
      "Ready",
    );
    globalThis.fetch = async () =>
      Response.json({ choices: [{ message: { content: '{"wrong":true}' } }] });
    await assert.rejects(
      () => completeJSON("Help", {}, z.object({ answer: z.string() })),
      /incomplete response/,
    );
    globalThis.fetch = async () => new Response("", { status: 429 });
    await assert.rejects(
      () => completeJSON("Help", {}, z.object({ answer: z.string() })),
      /limit reached/,
    );
    globalThis.fetch = async () => {
      throw new Error("secret provider error");
    };
    await assert.rejects(
      () => completeJSON("Help", {}, z.object({ answer: z.string() })),
      /timed out or could not connect/,
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.NEBIUS_API_KEY;
    else process.env.NEBIUS_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.NEBIUS_MODEL;
    else process.env.NEBIUS_MODEL = oldModel;
  }
});
