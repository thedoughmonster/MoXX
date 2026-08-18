import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { findServiceTestImpactPathDiagnostics } from
  "./find_service_test_impact_path_diagnostics.ts"
import { findServiceTestImpactSelectorDiagnostics } from
  "./find_service_test_impact_selector_diagnostics.ts"
import { loadServiceTestImpact } from "./load_service_test_impact.ts"
import { sortServiceTestImpactDiagnostics } from
  "./sort_service_test_impact_diagnostics.ts"
import type { LoadedService } from "./types.ts"
import {
  serviceTestImpactCategories,
  type ServiceTestImpactDiagnostic,
  type ServiceTestImpactMetadata,
  type ServiceTestImpactSelector,
} from "./service_test_impact_types.ts"

export async function findServiceTestImpactDiagnostics(
  services: LoadedService[], rootPath: string,
): Promise<ServiceTestImpactDiagnostic[]> {
  const diagnostics: ServiceTestImpactDiagnostic[] = []
  const globalIds = new Map<string, string[]>()
  for (const entry of loadServiceTestImpact(services)) {
    if (!entry.metadata) {
      diagnostics.push({ source: entry.source, field: "test_impact",
        code: "metadata_absent", target: entry.owner_service })
      continue
    }
    const metadata = entry.metadata as ServiceTestImpactMetadata
    if (metadata.schema_version !== 1) diagnostics.push({
      source: entry.source, field: "schema_version",
      code: "unsupported_version", target: String(metadata.schema_version),
    })
    if (metadata.owner_service !== entry.owner_service) diagnostics.push({
      source: entry.source, field: "owner_service", code: "owner_mismatch",
      target: metadata.owner_service,
    })
    const categories = metadata.categories as Record<string,
      ServiceTestImpactSelector[]> | undefined
    const missing = serviceTestImpactCategories.filter((key) =>
      !Array.isArray(categories?.[key]))
    if (missing.length > 0) diagnostics.push({
      source: entry.source, field: "categories", code: "categories_missing",
      target: missing.join(","),
    })
    const definitions = new Map<string, number>()
    for (const category of serviceTestImpactCategories) {
      const selectors = categories?.[category] ?? []
      const sorted = [...selectors].sort((left, right) =>
        compareUtf16(left.id, right.id))
      if (canonicalJson(selectors) !== canonicalJson(sorted)) diagnostics.push({
        source: entry.source, field: `categories.${category}`,
        code: "selectors_unsorted", target: category,
      })
      const ids = new Set<string>()
      for (const selector of selectors) {
        if (ids.has(selector.id)) diagnostics.push({
          source: entry.source, selector_id: selector.id, field: "id",
          code: "duplicate_selector_id", target: selector.id,
        })
        ids.add(selector.id)
        globalIds.set(selector.id,
          [...globalIds.get(selector.id) ?? [], entry.source])
        const definition = canonicalJson(selector)
        definitions.set(definition, (definitions.get(definition) ?? 0) + 1)
        diagnostics.push(...findServiceTestImpactSelectorDiagnostics(
          services, entry.source, entry.owner_service, category, selector,
        ))
        diagnostics.push(...await findServiceTestImpactPathDiagnostics(
          rootPath, entry.source, selector,
        ))
      }
    }
    for (const [definition, count] of definitions) {
      if (count > 1) diagnostics.push({ source: entry.source,
        field: "categories", code: "duplicate_selector", target: definition })
    }
  }
  for (const [id, sources] of globalIds) {
    if (sources.length > 1) diagnostics.push({
      source: [...sources].sort(compareUtf16)[0], selector_id: id, field: "id",
      code: "duplicate_selector_id",
      target: canonicalJson([...sources].sort(compareUtf16)),
    })
  }
  return sortServiceTestImpactDiagnostics(diagnostics)
}
