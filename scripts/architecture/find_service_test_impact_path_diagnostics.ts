import { lstat, realpath } from "node:fs/promises"
import { isAbsolute, join, sep } from "node:path"

import type { ServiceTestImpactDiagnostic, ServiceTestImpactSelector } from
  "./service_test_impact_types.ts"

export async function findServiceTestImpactPathDiagnostics(
  rootPath: string,
  source: string,
  selector: ServiceTestImpactSelector,
): Promise<ServiceTestImpactDiagnostic[]> {
  const target = selector.test
  const segments = target.split("/")
  const invalid = isAbsolute(target) || target.includes("\\") ||
    !target.endsWith(".test.ts") || segments.includes("") ||
    segments.includes(".") || segments.includes("..") ||
    segments.includes("node_modules")
  if (invalid) return [{ source, selector_id: selector.id, field: "test",
    code: "invalid_test_path", target }]
  const absolute = join(rootPath, target)
  try {
    const [rootReal, targetReal, stat] = await Promise.all([
      realpath(rootPath), realpath(absolute), lstat(absolute),
    ])
    if (stat.isSymbolicLink() || !stat.isFile() ||
      !targetReal.startsWith(`${rootReal}${sep}`)) {
      return [{ source, selector_id: selector.id, field: "test",
        code: "path_escape", target }]
    }
  } catch {
    return [{ source, selector_id: selector.id, field: "test",
      code: "test_missing", target }]
  }
  return []
}
