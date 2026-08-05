import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../src/handle_request.ts";

test("exposes a side-effect-free deployment liveness probe", async () => {
  const probe = await handleRequest(
    new Request("https://example.test/governor", { method: "OPTIONS" }),
  );
  assert.equal(probe.status, 204);
  assert.equal(probe.headers.get("allow"), "GET, POST, OPTIONS");
});
