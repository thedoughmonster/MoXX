import type {
  ImplementationStatus,
  ServiceStatusClassification,
} from "./service_manifest_types.ts"

export function classifyServiceStatus(
  status?: ImplementationStatus,
): ServiceStatusClassification {
  if (status === "operational") {
    return { implementation: status, availability: "expected_available" }
  }
  if (status === "hosted_inactive") {
    return { implementation: status, availability: "unavailable" }
  }
  return {
    implementation: status ?? "unclassified",
    availability: "not_asserted",
  }
}
