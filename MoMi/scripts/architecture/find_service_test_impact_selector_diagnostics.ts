import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { LoadedService } from "./types.ts"
import type {
  ServiceTestImpactCategory,
  ServiceTestImpactDiagnostic,
  ServiceTestImpactSelector,
} from "./service_test_impact_types.ts"

export function findServiceTestImpactSelectorDiagnostics(
  services: LoadedService[], source: string, owner: string,
  category: ServiceTestImpactCategory, selector: ServiceTestImpactSelector,
): ServiceTestImpactDiagnostic[] {
  const diagnostics: ServiceTestImpactDiagnostic[] = []
  const add = (field: string, code: ServiceTestImpactDiagnostic["code"],
    target: string) => diagnostics.push({
      source, selector_id: selector.id, field, code, target,
    })
  const byKey = new Map(services.map((item) =>
    [item.manifest.service_key, item]))
  if (!selector.id.startsWith(`${owner}:${category}:`)) {
    add("id", "category_rule_mismatch", selector.id)
  }
  const sortedServices = [...selector.services].sort(compareUtf16)
  if (canonicalJson(selector.services) !== canonicalJson(sortedServices)) {
    add("services", "services_unsorted", canonicalJson(selector.services))
  }
  for (const key of selector.services) {
    if (!byKey.has(key)) add("services", "unknown_service", key)
  }
  if (!selector.services.includes(owner)) {
    add("services", "category_rule_mismatch", "owner_service missing")
  }
  if (["local_unit", "local_integration"].includes(category) &&
    canonicalJson(selector.services) !== canonicalJson([owner])) {
    add("services", "category_rule_mismatch", category)
  }
  const sortedTriggers = [...selector.triggers].sort(compareUtf16)
  if (canonicalJson(selector.triggers) !== canonicalJson(sortedTriggers)) {
    add("triggers", "triggers_unsorted", canonicalJson(selector.triggers))
  }
  if (category !== "risk_triggered" && selector.triggers.length > 0) {
    add("triggers", "category_rule_mismatch", category)
  }
  if (category === "risk_triggered" && selector.triggers.length === 0) {
    add("triggers", "category_rule_mismatch", "risk trigger required")
  }
  const allowedTriggers = [
    "architecture", "docs", "manifest", "migration",
    "repository_tooling", "runtime", "unknown", "workflow",
  ]
  for (const trigger of selector.triggers) {
    if (!allowedTriggers.includes(trigger)) {
      add("triggers", "invalid_trigger", String(trigger))
    }
  }
  const sortedContracts = [...selector.contracts].sort((left, right) =>
    compareUtf16(canonicalJson([left.provider_service, left.contract]),
      canonicalJson([right.provider_service, right.contract])))
  if (canonicalJson(selector.contracts) !== canonicalJson(sortedContracts)) {
    add("contracts", "contracts_unsorted", canonicalJson(selector.contracts))
  }
  for (const reference of selector.contracts) {
    const provider = byKey.get(reference.provider_service)
    if (!provider || !provider.manifest.contracts.provides
      .includes(reference.contract) ||
      !selector.services.includes(reference.provider_service)) {
      add("contracts", "contract_mismatch", canonicalJson(reference))
    }
  }
  const owned = selector.contracts.every((item) =>
    item.provider_service === owner && byKey.get(owner)?.manifest.contracts
      .provides.includes(item.contract))
  if (category === "provider_contract" &&
    (selector.contracts.length === 0 || !owned)) {
    add("contracts", "category_rule_mismatch", "provider contract")
  }
  const consumed = selector.contracts.every((item) =>
    byKey.get(owner)?.manifest.contracts.consumes.some((dependency) =>
      dependency.service === item.provider_service &&
      dependency.contract === item.contract))
  if (category === "consumer_contract" &&
    (selector.contracts.length === 0 || !consumed)) {
    add("contracts", "category_rule_mismatch", "consumer contract")
  }
  if (category === "cross_service_integration") {
    const connected = selector.contracts.some((item) =>
      services.some((service) => selector.services.includes(
        service.manifest.service_key,
      ) && service.manifest.contracts.consumes.some((dependency) =>
        dependency.service === item.provider_service &&
        dependency.contract === item.contract)))
    if (selector.services.length < 2 || !connected) {
      add("contracts", "category_rule_mismatch", "cross-service dependency")
    }
  }
  if (["local_unit", "local_integration"].includes(category) &&
    selector.contracts.length > 0) {
    add("contracts", "category_rule_mismatch", category)
  }
  return diagnostics
}
