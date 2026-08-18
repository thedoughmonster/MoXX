import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { collectServiceCapabilityEffects } from
  "./collect_service_capability_effects.ts"
import type {
  FunctionCalledContract,
  FunctionCapabilityEdge,
  FunctionTransitiveEffect,
} from "./function_capability_model_types.ts"
import type { LoadedService } from "./types.ts"

export function collectFunctionTransitiveEffects(
  ownerService: string,
  calledContracts: FunctionCalledContract[],
  services: Map<string, LoadedService>,
): FunctionTransitiveEffect[] {
  const queue: Array<{
    provider: string
    path: FunctionCapabilityEdge[]
  }> = calledContracts.map((called) => ({
    provider: called.service,
    path: [{
      provider: called.service,
      consumer: ownerService,
      contract: called.contract,
    }],
  }))
  const traversed = new Set<string>()
  const grouped = new Map<string, FunctionTransitiveEffect>()
  while (queue.length > 0) {
    const current = queue.shift()!
    const pathKey = canonicalJson(current.path)
    if (traversed.has(pathKey)) continue
    traversed.add(pathKey)
    const loaded = services.get(current.provider)
    if (!loaded) continue
    for (const source of collectServiceCapabilityEffects(loaded)) {
      const key = canonicalJson([
        source.effect_kind, source.target, source.provider_service,
        source.source_path, source.source_pointer,
      ])
      const existing = grouped.get(key) ?? { ...source, provenance_paths: [] }
      if (!existing.provenance_paths.some((path) =>
        canonicalJson(path) === pathKey)) existing.provenance_paths.push(current.path)
      grouped.set(key, existing)
    }
    const upstream = [...loaded.manifest.contracts.consumes].sort((a, b) =>
      compareUtf16(canonicalJson(a), canonicalJson(b)))
    for (const dependency of upstream) queue.push({
      provider: dependency.service,
      path: [...current.path, {
        provider: dependency.service,
        consumer: loaded.manifest.service_key,
        contract: dependency.contract,
      }],
    })
  }
  const effects = [...grouped.values()]
  for (const effect of effects) effect.provenance_paths.sort((a, b) =>
    compareUtf16(canonicalJson(a), canonicalJson(b)))
  return effects.sort((a, b) => compareUtf16(canonicalJson([
    a.effect_kind, a.target, a.provider_service, a.source_path, a.source_pointer,
  ]), canonicalJson([
    b.effect_kind, b.target, b.provider_service, b.source_path, b.source_pointer,
  ])))
}
