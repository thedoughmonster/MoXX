import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { classifyHttpError } from "../src/classify_http_error.ts";
import { extractResponseResources } from "../src/extract_resources.ts";
import { isAcceptedNoContent } from "../src/is_accepted_no_content.ts";
import { makeFixture } from "./test_fixture.ts";

test("classifies rate limits and server failures for durable recovery", () => {
  assert.equal(classifyHttpError(429), "toast_rate_limited");
  assert.equal(classifyHttpError(500), "toast_server_error");
  assert.equal(classifyHttpError(503), "toast_server_error");
  assert.equal(classifyHttpError(200), null);
});

test("accepts 204 only for the registered kitchen coverage endpoint", () => {
  const { operation } = makeFixture();
  const kitchen = {
    ...operation,
    operation_key: "toast.kitchen.fulfillments.v1",
    path_template: "/kitchen/v1/export/itemFulfillments",
    resource_type: "kitchen_fulfillment",
    pagination_kind: "none" as const,
  };
  assert.equal(isAcceptedNoContent(kitchen, 204), true);
  assert.equal(isAcceptedNoContent(operation, 204), false);
  assert.equal(isAcceptedNoContent(kitchen, 200), false);
});

test("handles empty, collection, document, and status response shapes", () => {
  const { operation } = makeFixture();
  assert.deepEqual(extractResponseResources([], operation, 200), []);
  assert.deepEqual(
    extractResponseResources([{ guid: "one" }, "two"], operation, 200),
    [{ guid: "one" }, { value: "two" }],
  );
  assert.deepEqual(
    extractResponseResources(
      { guid: "one", checks: [] },
      { ...operation, response_kind: "document" },
      200,
    ),
    [{ guid: "one", checks: [] }],
  );
  assert.deepEqual(
    extractResponseResources(
      null,
      { ...operation, response_kind: "status" },
      200,
    ),
    [{ http_status: 200, value: null }],
  );
  assert.throws(() =>
    extractResponseResources(
      { unexpected: true },
      operation,
      200,
    ), /not an array/);
});

test("deduplicates versions while inserting every new observation", async () => {
  const source = await readFile(
    new URL("../src/persist_resources.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /on conflict \([\s\S]*\) do nothing/);
  assert.match(source, /version_rows as/);
  assert.match(source, /insert into toast_raw\.resource_observations/);
  assert.match(source, /from normalized\s+join version_rows/);
  assert.doesNotMatch(
    source,
    /insert into toast_raw\.resource_observations[\s\S]*from inserted/,
  );
});

test("records accepted kitchen gaps as coverage before lifecycle advance", async () => {
  const source = await readFile(
    new URL("../src/process_page.ts", import.meta.url),
    "utf8",
  );
  const finalizer = await readFile(
    new URL("../src/finalize_page.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /recordCoverage\(\s*job,\s*request,\s*"accepted_gap"/);
  assert.match(source, /finalizePage\(job, request, nextCursor/);
  assert.match(finalizer, /continueJob\(job, nextCursor\)/);
  assert.match(finalizer, /completeJob\(job\)/);
  assert.ok(
    source.indexOf("recordCoverage") < source.indexOf("finalizePage(job"),
  );
});
