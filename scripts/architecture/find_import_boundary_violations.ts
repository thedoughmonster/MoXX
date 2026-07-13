import { dirname, resolve, sep } from "node:path"

import type { LoadedService, SourceModule } from "./types.ts"

export function findImportBoundaryViolations(
  modules: SourceModule[],
  services: LoadedService[],
): string[] {
  const violations: string[] = []

  for (const module of modules) {
    const normalizedModule = module.path.replaceAll(sep, "/")
    if (/\/utils(?:\/|\.ts$)/.test(normalizedModule)) {
      violations.push(`${module.path}: generic utils locations are forbidden`)
    }
    const consumer = services.find((candidate) =>
      candidate.manifest.service_key === module.service_key
    )
    if (!consumer) {
      violations.push(`${module.path}: unknown owning service`)
      continue
    }
    for (const specifier of module.imports) {
      if (!specifier.startsWith(".")) {
        continue
      }
      const target = resolve(dirname(module.path), specifier).replaceAll(sep, "/")
      const provider = services.find((candidate) =>
        target.startsWith(candidate.directory.replaceAll(sep, "/") + "/")
      )
      if (provider && provider.manifest.service_key !== module.service_key) {
        const allowed = consumer.manifest.contracts.consumes.some((contract) =>
          contract.service === provider.manifest.service_key &&
          target.includes(`/contracts/public/${contract.contract}/`)
        )
        if (!allowed) {
          violations.push(`${module.path}: imports ${provider.manifest.service_key} implementation`)
        }
      }
      const packageMatch = target.match(/\/packages\/([^/]+)/)
      if (
        packageMatch &&
        !consumer.manifest.approved_packages.includes(packageMatch[1])
      ) {
        violations.push(`${module.path}: package ${packageMatch[1]} is not approved`)
      }
    }
  }

  return violations
}
