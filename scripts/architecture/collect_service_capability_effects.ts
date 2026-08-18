import type { FunctionEffectSource } from
  "./function_capability_model_types.ts"
import type { LoadedService } from "./types.ts"

export function collectServiceCapabilityEffects(
  loaded: LoadedService,
): FunctionEffectSource[] {
  const service = loaded.manifest
  const source_path = `services/${service.service_key}/service.json`
  const effects: FunctionEffectSource[] = []
  for (const [index, target] of service.database.read.entries()) effects.push({
    effect_kind: "database_read", target,
    provider_service: service.service_key, source_path,
    source_pointer: `/database/read/${index}`,
  })
  for (const [index, target] of service.database.write.entries()) effects.push({
    effect_kind: "database_write", target,
    provider_service: service.service_key, source_path,
    source_pointer: `/database/write/${index}`,
  })
  for (const [index, target] of service.network.outbound_hosts.entries()) {
    effects.push({
      effect_kind: "network_outbound_host", target,
      provider_service: service.service_key, source_path,
      source_pointer: `/network/outbound_hosts/${index}`,
    })
  }
  for (const [index, target] of service.secrets.entries()) effects.push({
    effect_kind: "secret_reference", target,
    provider_service: service.service_key, source_path,
    source_pointer: `/secrets/${index}`,
  })
  for (const [index, target] of service.runtime_dependencies.entries()) {
    effects.push({
      effect_kind: "runtime_dependency", target,
      provider_service: service.service_key, source_path,
      source_pointer: `/runtime_dependencies/${index}`,
    })
  }
  for (const [index, target] of service.approved_packages.entries()) effects.push({
    effect_kind: "approved_package", target,
    provider_service: service.service_key, source_path,
    source_pointer: `/approved_packages/${index}`,
  })
  return effects
}
