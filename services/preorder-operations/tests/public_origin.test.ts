import assert from "node:assert/strict";
import test from "node:test";

import { publicOriginPolicy } from "../src/public_origin.ts";

const production = "https://preorder.dough.monster";
const preview = "https://moxi-web-preorder-preview.thedoughmonster.workers.dev";

test("allows only exact production and persistent preview browser origins", () => {
  for (const origin of [production, preview]) {
    const request = new Request("https://api.example.test", {
      headers: { origin },
    });
    assert.equal(publicOriginPolicy.isAllowed(request), true);
    const headers = publicOriginPolicy.responseHeaders(
      request, "content-type", "POST, OPTIONS",
    );
    assert.equal(headers["Access-Control-Allow-Origin"], origin);
    assert.equal(headers.Vary, "Origin");
  }

  for (const origin of [
    "https://evil.example",
    "https://preorder.dough.monster.evil.example",
    "http://preorder.dough.monster",
    "null",
  ]) {
    const request = new Request("https://api.example.test", {
      headers: { origin },
    });
    assert.equal(publicOriginPolicy.isAllowed(request), false);
    assert.equal(
      publicOriginPolicy.responseHeaders(request, "content-type", "POST")
        ["Access-Control-Allow-Origin"],
      undefined,
    );
  }
});

test("allows non-browser callers without emitting wildcard CORS", () => {
  const request = new Request("https://api.example.test");
  assert.equal(publicOriginPolicy.isAllowed(request), true);
  const headers = publicOriginPolicy.responseHeaders(request, "content-type", "POST");
  assert.equal(headers["Access-Control-Allow-Origin"], undefined);
  assert.doesNotMatch(JSON.stringify(headers), /\*/);
});
