import type { LoadedService } from "./types.ts"

export function findServiceStatusViolations(
  services: LoadedService[],
): string[] {
  const violations: string[] = []
  for (const { manifest } of services) {
    if (manifest.lifecycle_status === "retired" &&
      manifest.implementation_status === "operational") {
      violations.push(
        `${manifest.service_key}/service.json: /implementation_status ` +
          "operational is forbidden when /lifecycle_status is retired",
      )
    }
  }
  return violations
}
