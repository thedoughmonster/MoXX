import { access, readFile } from "node:fs/promises"
import { join } from "node:path"

import type {
  FunctionManifest,
  LoadedFunction,
  LoadedService,
  WorkspaceConfig,
} from "./types.ts"
import { functionSchemaPath, workspaceRoot } from "./paths.ts"
import { readJson } from "./read_json.ts"
import { resolveFunctionDirectory } from "./resolve_function_directory.ts"
import { validateJson } from "./validate_json.ts"

export async function loadFunctions(
  workspace: WorkspaceConfig,
  services: LoadedService[],
): Promise<LoadedFunction[]> {
  const schema = await readJson<object>(functionSchemaPath)
  const functions: LoadedFunction[] = []
  const slugs = new Set<string>()

  for (const service of services) {
    await access(join(service.directory, "AGENTS.md"))
    const serviceReadme = await readFile(join(service.directory, "README.md"), "utf8")
    if (!/^## ELI5$/m.test(serviceReadme)) {
      throw new Error(`${service.manifest.service_key}: missing README ELI5`)
    }
    for (const slug of service.manifest.functions) {
      if (slugs.has(slug)) {
        throw new Error(`${slug}: owned by more than one service`)
      }
      slugs.add(slug)
      const directory = await resolveFunctionDirectory(workspace, service, slug)
      const readme = await readFile(join(directory, "README.md"), "utf8")
      if (!/^## ELI5$/m.test(readme)) {
        throw new Error(`${slug}: missing README ELI5`)
      }
      const manifest = await readJson<FunctionManifest>(join(directory, "function.json"))
      validateJson(schema, manifest, `${slug}/function.json`)
      if (manifest.owner_service !== service.manifest.service_key) {
        throw new Error(`${slug}: owner_service must be ${service.manifest.service_key}`)
      }
      if (manifest.route_path !== `/functions/v1/${slug}`) {
        throw new Error(`${slug}: route_path does not match its slug`)
      }
      await access(join(directory, manifest.input_schema))
      await access(join(directory, manifest.output_schema))
      functions.push({
        adapter_directory: join(workspaceRoot, workspace.paths.function_adapters, slug),
        source_directory: directory,
        manifest_directory: directory,
        slug,
        service,
        manifest,
      })
    }
  }

  return functions
}
