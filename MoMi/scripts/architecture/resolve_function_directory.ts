import { access } from "node:fs/promises"
import { join } from "node:path"

import type { LoadedService, WorkspaceConfig } from "./types.ts"
import { workspaceRoot } from "./paths.ts"

export async function resolveFunctionDirectory(
  workspace: WorkspaceConfig,
  service: LoadedService,
  slug: string,
): Promise<string> {
  const owned = join(service.directory, "functions", slug)
  try {
    await access(join(owned, "function.json"))
    return owned
  } catch (error) {
    if (
      workspace.layout !== "transition" ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error
    }
  }

  return join(workspaceRoot, workspace.paths.function_adapters, slug)
}
