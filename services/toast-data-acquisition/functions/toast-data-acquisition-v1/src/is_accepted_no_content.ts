import type { RegisteredOperation } from "./registry_types.ts";

export function isAcceptedNoContent(
  operation: RegisteredOperation,
  status: number,
): boolean {
  return status === 204 && operation.resource_type === "kitchen_fulfillment" &&
    operation.path_template === "/kitchen/v1/export/itemFulfillments";
}
