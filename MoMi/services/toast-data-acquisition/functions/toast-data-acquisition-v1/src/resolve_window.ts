import type { JsonObject } from "./json_types.ts";
import type { ClaimedJob, RegisteredOperation, WindowResolution } from "./registry_types.ts";

export function resolveWindow(
  job: ClaimedJob,
  operation: RegisteredOperation,
  now: string = new Date().toISOString(),
): WindowResolution {
  const empty: WindowResolution = {
    parameters: {},
    cursor_context: {},
    next_cursor: null,
    coverage_start: job.window_start,
    coverage_end: job.window_end,
  };
  const allowedCursor = new Set([
    "page", "pageToken", "window_start", "businessDate",
  ]);
  if (Object.keys(job.cursor).some((key) => !allowedCursor.has(key))) {
    throw new Error("Acquisition cursor contains an unsupported key");
  }
  const queryKeys = new Set(operation.operation_parameters
    .filter((parameter) => parameter.parameter_location === "query")
    .map((parameter) => parameter.parameter_key));
  const selector = job.parameters.date_selector;
  const requiredBusinessDate = operation.operation_parameters.some((
    parameter,
  ) => parameter.parameter_key === "businessDate" && parameter.required);
  const businessKey = selector ?? (requiredBusinessDate ? "businessDate" : null);
  if (businessKey !== null) {
    if (typeof businessKey !== "string" || !queryKeys.has(businessKey) ||
      !businessKey.endsWith("BusinessDate") && businessKey !== "businessDate") {
      throw new Error("Business-date selector is not registered");
    }
    if (job.parameters[businessKey] !== undefined) return empty;
    if (!job.window_start || !job.window_end) {
      throw new Error("Business-date operation requires a window");
    }
    const initial = job.window_start.slice(0, 10).replaceAll("-", "");
    const current = job.cursor.businessDate ?? initial;
    if (typeof current !== "string" || !/^[0-9]{8}$/.test(current)) {
      throw new Error("Business-date cursor is invalid");
    }
    const day = new Date(
      `${current.slice(0, 4)}-${current.slice(4, 6)}-${
        current.slice(6)
      }T00:00:00.000Z`,
    );
    if (day.toISOString().slice(0, 10).replaceAll("-", "") !== current) {
      throw new Error("Business-date cursor is not a calendar date");
    }
    const nextDay = new Date(day.getTime() + 86400000);
    const next = nextDay.toISOString().slice(0, 10).replaceAll("-", "");
    const exclusiveEnd = job.window_end.slice(0, 10).replaceAll("-", "");
    return {
      parameters: { [businessKey]: current },
      cursor_context: { businessDate: current },
      next_cursor: next < exclusiveEnd ? { businessDate: next } : null,
      coverage_start: day.toISOString(),
      coverage_end: nextDay.toISOString(),
    };
  }
  if (job.cursor.businessDate !== undefined) {
    throw new Error("Business-date cursor is not valid for this operation");
  }
  const hasStart = job.parameters.startDate !== undefined;
  const hasEnd = job.parameters.endDate !== undefined;
  const hasModifiedStart = job.parameters.modifiedStartDate !== undefined;
  const hasModifiedEnd = job.parameters.modifiedEndDate !== undefined;
  if (hasStart !== hasEnd || hasModifiedStart !== hasModifiedEnd) {
    throw new Error("Explicit window parameters must be paired");
  }
  const hasExplicitWindow = ["businessDate", "shiftIds", "timeEntryIds"]
    .some((key) => job.parameters[key] !== undefined) || hasStart || hasModifiedStart;
  if (!operation.requires_window || hasExplicitWindow) {
    if (job.cursor.window_start !== undefined) {
      throw new Error("Window cursor is not valid for explicit parameters");
    }
    return empty;
  }
  const policy = job.parameters.window_policy;
  if (policy !== undefined && policy !== "first_business_date") {
    throw new Error("Window policy is not supported");
  }
  const initialStart = policy === "first_business_date"
    ? operation.first_business_date && `${operation.first_business_date}T00:00:00.000Z`
    : job.window_start;
  const startValue = job.cursor.window_start ?? initialStart;
  const endValue = job.window_end ??
    (policy === "first_business_date" ? now : null);
  if (typeof startValue !== "string" || !endValue) {
    throw new Error("Registered operation requires a complete window");
  }
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (!Number.isFinite(start.getTime()) || end <= start) {
    throw new Error("Acquisition window is invalid");
  }
  const sliceEnd = new Date(Math.min(end.getTime(), start.getTime() + 28 * 86400000));
  const modified = operation.resource_type === "time_entry" && queryKeys.has(
    "modifiedStartDate") && queryKeys.has("modifiedEndDate");
  const startKey = modified ? "modifiedStartDate" : "startDate";
  const endKey = modified ? "modifiedEndDate" : "endDate";
  if (!queryKeys.has(startKey) || !queryKeys.has(endKey)) {
    throw new Error("Registered window parameters are unavailable");
  }
  const context: JsonObject = { window_start: start.toISOString() };
  return {
    parameters: {
      [startKey]: start.toISOString(),
      [endKey]: sliceEnd.toISOString(),
    },
    cursor_context: context,
    next_cursor: sliceEnd < end ? { window_start: sliceEnd.toISOString() } : null,
    coverage_start: start.toISOString(),
    coverage_end: sliceEnd.toISOString(),
  };
}
