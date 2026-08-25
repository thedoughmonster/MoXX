import { readdir } from "node:fs/promises"
import { join } from "node:path"

import type { ExternalFunctionAuthority } from
  "./external_function_authority_types.ts"
import { findExternalFunctionAuthorityValidityViolations } from
  "./find_external_function_authority_validity_violations.ts"
import type { WorkspaceConfig } from "./types.ts"
import { readJson } from "./read_json.ts"
import {
  externalFunctionAuthoritySchemaPath,
  workspaceRoot,
} from "./paths.ts"
import { validateJson } from "./validate_json.ts"

export async function loadExternalFunctionAuthorities(
  directory: string,
  workspace: WorkspaceConfig,
): Promise<ExternalFunctionAuthority[]> {
  const root = join(workspaceRoot, directory)
  const schema = await readJson<object>(externalFunctionAuthoritySchemaPath)
  const files = (await readdir(root)).filter((file) => file.endsWith(".json")).sort()
  const authorities: ExternalFunctionAuthority[] = []
  const keys = new Set<string>()
  for (const file of files) {
    const authority = await readJson<ExternalFunctionAuthority>(join(root, file))
    validateJson(schema, authority, `${directory}/${file}`)
    if (file !== `${authority.function_slug}.json`) {
      throw new Error(`${file}: filename must match function_slug`)
    }
    if (authority.owner_repository === "thedoughmonster/momi-backend") {
      throw new Error(`${file}: external owner must be another repository`)
    }
    if (authority.adapter_path !==
      `supabase/functions/${authority.function_slug}/index.ts`) {
      throw new Error(`${file}: adapter_path must match function_slug`)
    }
    for (const environment of authority.environments) {
      const key = `${environment.name}:${authority.function_slug}`
      if (keys.has(key)) throw new Error(`${file}: duplicate authority ${key}`)
      if (environment.project_ref !== workspace.environments[environment.name].project_ref) {
        throw new Error(`${file}: project_ref does not match workspace ${environment.name}`)
      }
      keys.add(key)
    }
    authorities.push(authority)
  }
  const validityViolations = findExternalFunctionAuthorityValidityViolations(
    authorities,
  )
  if (validityViolations.length > 0) {
    throw new Error(`External authority violations:\n- ${validityViolations.join("\n- ")}`)
  }
  return authorities
}
