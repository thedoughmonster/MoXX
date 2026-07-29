import assert from "node:assert/strict";
import test from "node:test";

import { handleRequestWithCreator } from "../src/handle_request_with_creator.ts";
import { fixture } from "./fixture.ts";

test("maps conflicts, rejection, and rate limits safely", async () => {
  const conflict = await handleRequestWithCreator(
    new Request(
      "https://example.test/",
      {
        method: "POST",
        body: JSON.stringify(fixture.request),
      },
    ),
    () =>
      Promise.resolve({
        admitted: true,
        result: {
          outcome: "conflict",
          error: {
            code: "stale_version",
            message: "The preorder configuration changed.",
            retryable: true,
            next_action: "refresh",
          },
        },
      }),
  );
  assert.equal(conflict.status, 409);
  const rejected = await handleRequestWithCreator(
    new Request(
      "https://example.test/",
      {
        method: "POST",
        body: JSON.stringify(fixture.request),
      },
    ),
    () =>
      Promise.resolve({
        admitted: true,
        result: {
          outcome: "rejected",
          error: {
            code: "allergen_unverified",
            message: "A selected item conflicts with the allergen choices.",
            retryable: false,
            next_action: "choose_another_item",
          },
        },
      }),
  );
  assert.equal(rejected.status, 422);
  const limited = await handleRequestWithCreator(
    new Request(
      "https://example.test/",
      {
        method: "POST",
        body: JSON.stringify(fixture.request),
      },
    ),
    () => Promise.resolve({ admitted: false, result: null }),
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
});
