import { canonicalJson } from "./canonical_json.ts"
import {
  MAX_METRIC_ENTRIES,
  MAX_METRICS_BYTES,
  RECEIPT_BOOLEAN_KEYS,
  RECEIPT_EVENT_TYPES,
  RECEIPT_METRIC_GROUPS,
  RECEIPT_NUMBER_KEYS,
  RECEIPT_STRING_KEYS,
} from "./receipt_constants.ts"
import type { ReceiptInput, ReceiptMetricKey } from "./receipt_types.ts"
import { validateMetricScalar } from "./validate_metric_scalar.ts"

export function validateReceiptInput(value: unknown): asserts value is ReceiptInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Receipt input must be an object")
  }
  const input = value as Record<string, unknown>
  if (Object.keys(input).sort().join(",") !== "event_type,metrics,timestamp_utc") {
    throw new Error("Receipt input contains unsupported fields")
  }
  if (!RECEIPT_EVENT_TYPES.includes(input.event_type as never)) {
    throw new Error("Receipt event_type is invalid")
  }
  if (typeof input.timestamp_utc !== "string" ||
      new Date(input.timestamp_utc).toISOString() !== input.timestamp_utc) {
    throw new Error("Receipt timestamp_utc must be canonical UTC")
  }
  if (!input.metrics || typeof input.metrics !== "object" || Array.isArray(input.metrics) ||
      Object.getPrototypeOf(input.metrics) !== Object.prototype) {
    throw new Error("Receipt metrics must be a plain object")
  }
  const metrics = input.metrics as Record<string, unknown>
  if (Object.keys(metrics).length > MAX_METRIC_ENTRIES ||
      Buffer.byteLength(canonicalJson(metrics), "utf8") > MAX_METRICS_BYTES) {
    throw new Error("Receipt metrics exceed their bound")
  }
  const scalarKeys = [...RECEIPT_BOOLEAN_KEYS, ...RECEIPT_NUMBER_KEYS, ...RECEIPT_STRING_KEYS]
  for (const [key, metric] of Object.entries(metrics)) {
    if (RECEIPT_METRIC_GROUPS.includes(key as never)) {
      if (!metric || typeof metric !== "object" || Array.isArray(metric) ||
          Object.getPrototypeOf(metric) !== Object.prototype) {
        throw new Error(`Receipt metric group ${key} must be a plain object`)
      }
      const entries = Object.entries(metric as Record<string, unknown>)
      if (entries.length > MAX_METRIC_ENTRIES) throw new Error("Receipt metric group is too large")
      for (const [nestedKey, nestedValue] of entries) {
        if (!scalarKeys.includes(nestedKey as ReceiptMetricKey)) {
          throw new Error(`Unsupported receipt metric: ${nestedKey}`)
        }
        validateMetricScalar(nestedKey as ReceiptMetricKey, nestedValue)
      }
      continue
    }
    if (!scalarKeys.includes(key as ReceiptMetricKey)) {
      throw new Error(`Unsupported receipt metric: ${key}`)
    }
    validateMetricScalar(key as ReceiptMetricKey, metric)
  }
}
