import assert from "node:assert/strict";
import test from "node:test";

import { resolveWindow } from "../src/resolve_window.ts";
import { makeFixture } from "./test_fixture.ts";

test("resolves order and shift windows to bounded start/end pairs", () => {
  const { job, operation } = makeFixture();
  const orders = resolveWindow(job, operation);
  assert.deepEqual(orders.parameters, {
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-03T00:00:00.000Z",
  });
  const shifts = resolveWindow(job, {
    ...operation,
    operation_key: "toast.labor.shifts.v1",
    resource_type: "shift",
    pagination_kind: "none",
    page_size: null,
    operation_parameters: operation.operation_parameters.slice(0, 2),
  });
  assert.deepEqual(shifts.parameters, orders.parameters);
});

test("uses modified windows for time-entry reconciliation", () => {
  const { job, operation } = makeFixture();
  const timeEntries = {
    ...operation,
    operation_key: "toast.labor.time_entries.v1",
    resource_type: "time_entry",
    pagination_kind: "none" as const,
    page_size: null,
    operation_parameters: [
      ...operation.operation_parameters.slice(0, 2),
      {
        parameter_key: "modifiedStartDate",
        parameter_location: "query" as const,
        data_type: "timestamp" as const,
        required: false,
        validation_pattern: null,
      },
      {
        parameter_key: "modifiedEndDate",
        parameter_location: "query" as const,
        data_type: "timestamp" as const,
        required: false,
        validation_pattern: null,
      },
    ],
  };
  assert.deepEqual(resolveWindow(job, timeEntries).parameters, {
    modifiedStartDate: "2026-07-01T00:00:00.000Z",
    modifiedEndDate: "2026-07-03T00:00:00.000Z",
  });
});

test("advances required business-date endpoints one day at a time", () => {
  const { job, operation } = makeFixture();
  const cashOperation = {
    ...operation,
    operation_key: "toast.cash.entries.v1",
    resource_type: "cash_entry",
    pagination_kind: "none" as const,
    page_size: null,
    operation_parameters: [{
      parameter_key: "businessDate",
      parameter_location: "query" as const,
      data_type: "date" as const,
      required: true,
      validation_pattern: "^[0-9]{8}$",
    }],
  };
  const first = resolveWindow(job, cashOperation);
  assert.deepEqual(first.parameters, { businessDate: "20260701" });
  assert.deepEqual(first.next_cursor, { businessDate: "20260702" });
  const second = resolveWindow({
    ...job,
    cursor: { businessDate: "20260702" },
  }, cashOperation);
  assert.deepEqual(second.parameters, { businessDate: "20260702" });
  assert.equal(second.next_cursor, null);
});

test("bounds first-business-date reconciliation into resumable slices", () => {
  const { job, operation } = makeFixture();
  const result = resolveWindow({
    ...job,
    window_start: null,
    window_end: null,
    parameters: { window_policy: "first_business_date" },
  }, {
    ...operation,
    operation_key: "toast.labor.shifts.v1",
    resource_type: "shift",
    pagination_kind: "none",
    page_size: null,
    first_business_date: "2024-06-21",
    operation_parameters: operation.operation_parameters.slice(0, 2),
  }, "2024-08-20T00:00:00.000Z");
  assert.deepEqual(result.parameters, {
    startDate: "2024-06-21T00:00:00.000Z",
    endDate: "2024-07-19T00:00:00.000Z",
  });
  assert.deepEqual(result.next_cursor, {
    window_start: "2024-07-19T00:00:00.000Z",
  });
});
