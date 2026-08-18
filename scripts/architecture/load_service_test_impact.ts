import type { LoadedService } from "./types.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import type { ServiceTestImpactSource } from
  "./service_test_impact_types.ts"

export function loadServiceTestImpact(
  services: LoadedService[],
): ServiceTestImpactSource[] {
  return services.map((service) => {
    const owner = service.manifest.service_key
    return {
      source: `services/${owner}/service.json`,
      owner_service: owner,
      metadata: service.manifest.test_impact,
    }
  }).sort((left, right) => compareUtf16(
    left.owner_service, right.owner_service,
  ))
}
