import { readFile, readdir } from "node:fs/promises"
import type { Dirent } from "node:fs"
import { dirname, join, relative, sep } from "node:path"

import { parseFunctionVerifyJwt } from "../deploy/parse_function_verify_jwt.ts"
import { workspaceRoot } from "./paths.ts"
import type { LoadedService, WorkspaceConfig } from "./types.ts"

export async function findFunctionInventoryViolations(
  workspace: WorkspaceConfig,
  services: LoadedService[],
  root = workspaceRoot,
): Promise<string[]> {
  const violations: string[] = []
  const declaredOwners = new Map<string, string[]>()
  for (const service of services) {
    for (const slug of service.manifest.functions) {
      const owners = declaredOwners.get(slug) ?? []
      owners.push(service.manifest.service_key)
      declaredOwners.set(slug, owners)
    }
    const functionsRoot = join(
      root,
      workspace.paths.services,
      service.manifest.service_key,
      "functions",
    )
    let entries: Dirent[] = []
    try {
      entries = await readdir(functionsRoot, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        violations.push(
          `${relative(root, functionsRoot).replaceAll(sep, "/")}: unable to read function directory`,
        )
      }
    }
    const directories = new Set(
      entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    )
    for (const entry of entries.filter((item) => item.isSymbolicLink())) {
      violations.push(
        `${relative(root, join(functionsRoot, entry.name)).replaceAll(sep, "/")}: function directory must not be a symlink`,
      )
    }
    for (const slug of [...directories].sort()) {
      if (!service.manifest.functions.includes(slug)) {
        violations.push(
          `${relative(root, join(functionsRoot, slug)).replaceAll(sep, "/")}: not declared by ${service.manifest.service_key}/service.json`,
        )
      }
    }
    for (const slug of [...service.manifest.functions].sort()) {
      if (!directories.has(slug)) {
        violations.push(`${service.manifest.service_key}: missing function directory ${slug}`)
      }
    }
  }
  for (const [slug, owners] of declaredOwners) {
    if (owners.length > 1) {
      violations.push(`${slug}: declared by multiple services ${owners.sort().join(", ")}`)
    }
  }
  const adapterRoot = join(root, workspace.paths.function_adapters)
  let adapterEntries: Dirent[] = []
  try {
    adapterEntries = await readdir(adapterRoot, { withFileTypes: true })
  } catch {
    violations.push("supabase/functions: unable to read adapter directory")
  }
  const adapters = new Set(
    adapterEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  )
  for (const entry of adapterEntries.filter((item) => item.isSymbolicLink())) {
    violations.push(
      `${relative(root, join(adapterRoot, entry.name)).replaceAll(sep, "/")}: adapter must not be a symlink`,
    )
  }
  for (const slug of [...adapters].sort()) {
    if (!declaredOwners.has(slug)) {
      violations.push(`supabase/functions/${slug}: not declared by a service manifest`)
    }
  }
  for (const slug of [...declaredOwners.keys()].sort()) {
    if (!adapters.has(slug)) violations.push(`${slug}: missing Supabase adapter`)
  }
  const configPath = join(root, dirname(workspace.paths.function_adapters), "config.toml")
  let configSource: string | null = null
  try {
    configSource = await readFile(configPath, "utf8")
  } catch {
    violations.push("supabase/config.toml: unable to read configuration")
  }
  if (configSource !== null) try {
    const config = parseFunctionVerifyJwt(configSource)
    for (const slug of [...config.keys()].sort()) {
      if (!declaredOwners.has(slug)) {
        violations.push(`supabase/config.toml [functions.${slug}]: not declared by a service manifest`)
      }
    }
    for (const slug of [...declaredOwners.keys()].sort()) {
      if (!config.has(slug)) violations.push(`${slug}: missing supabase/config.toml section`)
    }
  } catch (error) {
    violations.push(`supabase/config.toml: ${(error as Error).message}`)
  }
  return violations.sort()
}
