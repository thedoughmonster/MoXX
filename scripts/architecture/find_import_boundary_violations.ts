import { dirname, resolve, sep } from "node:path"

import { computedImportSpecifier } from "./extract_imports.ts"
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
    const sourceIsTest = normalizedModule.includes("/tests/") ||
      normalizedModule.endsWith(".test.ts")
    if (!sourceIsTest && /\bDeno\.(?:open|readFile|readTextFile)(?:Sync)?\s*\(/.test(
      module.source,
    )) {
      violations.push(`${module.path}: runtime source must not load source files dynamically`)
    }
    for (const specifier of module.imports) {
      if (specifier === computedImportSpecifier) {
        violations.push(`${module.path}: computed dynamic imports are forbidden`)
        continue
      }
      if (!specifier.startsWith(".")) {
        const external = consumer.manifest.runtime_dependencies.some((dependency) => {
          if (dependency === specifier) return true
          const npmName = dependency.match(/^npm:((?:@[^/]+\/)?[^@/]+)@/)?.[1]
          return npmName === specifier || specifier.startsWith(`${npmName}/`)
        })
        if (!(sourceIsTest && specifier.startsWith("node:")) && !external) {
          violations.push(`${module.path}: bare import ${specifier} is not an approved external`)
        }
        continue
      }
      if (!specifier.endsWith(".ts")) {
        violations.push(`${module.path}: relative imports must name a TypeScript source file`)
        continue
      }
      const target = resolve(dirname(module.path), specifier).replaceAll(sep, "/")
      const targetIsTest = target.includes("/tests/") || target.endsWith(".test.ts")
      if (!sourceIsTest && targetIsTest) {
        violations.push(`${module.path}: runtime source must not import test code`)
      }
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
