import { deriveResource } from "./derive_resource.ts";
import type { JsonObject, JsonValue } from "./json_types.ts";
import type { RegisteredOperation } from "./registry_types.ts";
import type { ResourceRecord } from "./runtime_types.ts";

export async function deriveResources(
  payloads: Array<JsonObject | JsonValue[]>,
  operation: RegisteredOperation,
): Promise<ResourceRecord[]> {
  const records: ResourceRecord[] = [];
  for (const payload of payloads) {
    records.push(await deriveResource(payload, operation));
  }
  return records;
}
