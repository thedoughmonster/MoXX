import assert from "node:assert/strict";
import test from "node:test";

import { buildRegisteredRequest } from "../src/build_request.ts";
import { resolveNextCursor } from "../src/resolve_next_cursor.ts";
import { makeFixture } from "./test_fixture.ts";

test("continues only forward fixed pages from a same-endpoint Link", () => {
  const { job, operation } = makeFixture();
  const request = buildRegisteredRequest(job, operation);
  const linked = new URL(request.url);
  linked.searchParams.set("page", "2");
  const cursor = resolveNextCursor(operation, request, {
    link: `<${linked}>; rel="next"`,
  });
  assert.deepEqual(cursor, {
    window_start: "2026-07-01T00:00:00.000Z",
    page: 2,
  });
  assert.throws(() =>
    resolveNextCursor(operation, request, {
      link: '<https://evil.example/orders/v2/ordersBulk?page=2>; rel="next"',
    }), /left the registered endpoint/);
  linked.searchParams.set("page", "1");
  assert.throws(() =>
    resolveNextCursor(operation, request, {
      link: `<${linked}>; rel="next"`,
    }), /did not advance/);
  const laterRequest = buildRegisteredRequest(
    { ...job, cursor: { page: 3 } },
    operation,
  );
  linked.searchParams.set("page", "2");
  assert.throws(() =>
    resolveNextCursor(operation, laterRequest, {
      link: `<${linked}>; rel="next"`,
    }), /did not advance/);
});

test("continues token pagination from Toast-Next-Page-Token", () => {
  const { job, operation } = makeFixture();
  const cursorOperation = {
    ...operation,
    operation_key: "toast.config.discounts.list.v1",
    path_template: "/config/v2/discounts",
    resource_type: "discount",
    pagination_kind: "cursor" as const,
    page_size: null,
    requires_window: false,
    operation_parameters: [{
      parameter_key: "pageToken",
      parameter_location: "query" as const,
      data_type: "string" as const,
      required: false,
      validation_pattern: null,
    }],
  };
  const cursorJob = {
    ...job,
    operation_key: cursorOperation.operation_key,
    window_start: null,
    window_end: null,
  };
  const request = buildRegisteredRequest(cursorJob, cursorOperation);
  assert.deepEqual(
    resolveNextCursor(cursorOperation, request, {
      "toast-next-page-token": "next-token",
    }),
    { pageToken: "next-token" },
  );
  assert.equal(resolveNextCursor(cursorOperation, request, {}), null);
  const repeatedRequest = buildRegisteredRequest(
    { ...cursorJob, cursor: { pageToken: "current-token" } },
    cursorOperation,
  );
  assert.throws(() =>
    resolveNextCursor(cursorOperation, repeatedRequest, {
      "toast-next-page-token": "current-token",
    }), /repeated page token/);
});
