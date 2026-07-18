import { createHash } from "node:crypto"
import { relative, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { SourceModule } from "../architecture/types.ts"

export function hashServiceSource(
  modules: SourceModule[],
  serviceKey: string,
): string {
  const hash = createHash("sha256")
  for (const module of modules.filter((item) =>
    item.service_key === serviceKey &&
    !item.path.replaceAll(sep, "/").includes("/tests/")
  ).sort((left, right) => left.path.localeCompare(right.path))) {
    const subject = relative(workspaceRoot, module.path).replaceAll(sep, "/")
    hash.update(subject).update("\0").update(module.source).update("\0")
  }
  return `sha256:${hash.digest("hex")}`
}
