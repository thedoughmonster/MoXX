import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { ImpactClass } from "../dev_loop/types.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { findServiceTestImpactDiagnostics } from
  "./find_service_test_impact_diagnostics.ts"
import { loadServiceTestImpact } from "./load_service_test_impact.ts"
import { sortServiceTestImpactDiagnostics } from
  "./sort_service_test_impact_diagnostics.ts"
import type { Architecture } from "./types.ts"
import {
  serviceTestImpactCategories,
  ServiceTestImpactError,
  type ResolvedServiceTest,
  type ServiceTestImpactReason,
  type ServiceTestImpactResolution,
} from "./service_test_impact_types.ts"

export async function provideServiceTestImpact(
  architecture: Pick<Architecture, "services">,
  selectedServices: string[], impactClasses: ImpactClass[], rootPath: string,
  requireSelection = false,
): Promise<ServiceTestImpactResolution> {
  const selected = new Set(selectedServices)
  const sources = loadServiceTestImpact(architecture.services)
  const diagnostics = await findServiceTestImpactDiagnostics(
    architecture.services, rootPath,
  )
  for (const service of selected) {
    if (!sources.some((source) => source.owner_service === service)) {
      diagnostics.push({ source: "services", field: "selected_services",
        code: "unknown_service", target: service })
    }
  }
  const fatal = diagnostics.filter((item) => item.code !== "metadata_absent")
  if (fatal.length > 0) {
    throw new ServiceTestImpactError(sortServiceTestImpactDiagnostics(fatal))
  }
  const byTest = new Map<string, ResolvedServiceTest>()
  if (impactClasses.length > 0) for (const source of sources) {
    if (!selected.has(source.owner_service) || !source.metadata) continue
    for (const category of serviceTestImpactCategories) {
      for (const selector of source.metadata.categories[category]) {
        const matched = selector.triggers.filter((trigger) =>
          impactClasses.includes(trigger)).sort(compareUtf16)
        if (category === "risk_triggered" && matched.length === 0) continue
        const reason: ServiceTestImpactReason = {
          owner_service: source.owner_service, category,
          selector_id: selector.id, reason: selector.reason,
          matched_triggers: matched, services: selector.services,
          contracts: selector.contracts,
        }
        const existing = byTest.get(selector.test)
        if (existing) existing.reasons.push(reason)
        else byTest.set(selector.test, {
          test: selector.test, reasons: [reason],
          source_manifest: source.source, schema_version: 1,
        })
      }
    }
  }
  const tests = [...byTest.values()].sort((left, right) =>
    compareUtf16(left.test, right.test))
  for (const item of tests) item.reasons.sort((left, right) =>
    compareUtf16(canonicalJson([
      left.owner_service, left.category, left.selector_id,
      left.matched_triggers,
    ]), canonicalJson([
      right.owner_service, right.category, right.selector_id,
      right.matched_triggers,
    ])))
  const visible = diagnostics.filter((item) =>
    item.code !== "metadata_absent" || selected.has(item.target))
  if (requireSelection && tests.length === 0) {
    visible.push({ source: "service-test-impact", field: "tests",
      code: "selection_empty_when_required",
      target: [...selected].sort(compareUtf16).join(",") })
    throw new ServiceTestImpactError(sortServiceTestImpactDiagnostics(visible))
  }
  return {
    metadata: sources.filter((item) => selected.has(item.owner_service))
      .map((item) => ({ owner_service: item.owner_service,
        source_manifest: item.source,
        status: item.metadata ? "declared" as const : "metadata_absent" as const,
      })).sort((left, right) => compareUtf16(
        left.owner_service, right.owner_service,
      )),
    tests,
    diagnostics: sortServiceTestImpactDiagnostics(visible),
  }
}
