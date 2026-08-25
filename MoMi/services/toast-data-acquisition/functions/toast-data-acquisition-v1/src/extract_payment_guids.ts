import type { JsonObject, JsonValue } from "./json_types.ts";
import type { RegisteredOperation } from "./registry_types.ts";

export function extractPaymentGuids(
  operation: RegisteredOperation,
  payloads: Array<JsonObject | JsonValue[]>,
): string[] {
  if (operation.operation_key !== "toast.payments.list.v1") return [];
  return payloads.map((payload) => {
    if (
      Array.isArray(payload) || typeof payload.value !== "string" ||
      !/^[0-9a-fA-F-]+$/.test(payload.value)
    ) {
      throw new Error("Payment list item was not a GUID");
    }
    return payload.value;
  });
}
