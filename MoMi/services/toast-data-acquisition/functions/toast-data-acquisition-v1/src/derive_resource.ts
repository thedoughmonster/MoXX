import { canonicalizeJson } from "./canonicalize_json.ts";
import type { JsonObject, JsonValue } from "./json_types.ts";
import type { RegisteredOperation } from "./registry_types.ts";
import type { ResourceRecord } from "./runtime_types.ts";
import { hashText } from "./hash_text.ts";

const identityKeys = [
  "guid",
  "id",
  "uuid",
  "selectionGuid",
  "itemGuid",
  "menuItemGuid",
  "paymentGuid",
  "shiftId",
  "timeEntryId",
  "prepStationGuid",
  "multiLocationId",
  "externalId",
  "orderGuid",
  "restaurantGuid",
  "value",
];
const versionKeys = [
  "versionId",
  "version",
  "modifiedDate",
  "updatedAt",
  "lastModified",
  "modifiedAt",
];
const updatedKeys = ["modifiedDate", "updatedAt", "lastModified", "modifiedAt"];

export async function deriveResource(
  payload: JsonObject | JsonValue[],
  operation: RegisteredOperation,
): Promise<ResourceRecord> {
  const contentHash = await hashText(canonicalizeJson(payload));
  const record = Array.isArray(payload) ? null : payload;
  let sourceId = "";
  let sourceVersionId = "";
  let sourceUpdatedAt: string | null = null;
  if (record) {
    if (operation.resource_type === "device") {
      const serialNumber = record.serialNumber;
      const deviceInfo = record.PosDeviceInfo;
      const nestedId = deviceInfo && typeof deviceInfo === "object" &&
          !Array.isArray(deviceInfo)
        ? deviceInfo.deviceId
        : undefined;
      const deviceId =
        (typeof serialNumber === "string" && serialNumber.length > 0) ||
          typeof serialNumber === "number"
          ? serialNumber
          : nestedId;
      if (
        (typeof deviceId === "string" && deviceId.length > 0) ||
        typeof deviceId === "number"
      ) {
        sourceId = String(deviceId);
      }
    }
    if (!sourceId) {
      for (const key of identityKeys) {
        const value = record[key];
        if (
          (typeof value === "string" && value.length > 0) ||
          typeof value === "number"
        ) {
          sourceId = String(value);
          break;
        }
      }
    }
    for (const key of versionKeys) {
      const value = record[key];
      if (
        (typeof value === "string" && value.length > 0) ||
        typeof value === "number"
      ) {
        sourceVersionId = String(value);
        break;
      }
    }
    for (const key of updatedKeys) {
      const value = record[key];
      if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
        sourceUpdatedAt = new Date(value).toISOString();
        break;
      }
    }
  }
  return {
    source_id: sourceId || contentHash,
    source_version_id: sourceVersionId || contentHash,
    source_updated_at: sourceUpdatedAt,
    content_hash: contentHash,
    payload,
  };
}
