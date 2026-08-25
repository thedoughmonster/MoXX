import { spawnSync } from "node:child_process"

export type AuthoritySnapshot = {
  relationOwners: Map<string, string>
  routineOwners: Map<string, string>
  schemaOwners: Map<string, Set<string>>
}

type SnapshotManifest = {
  service_key?: unknown
  owned_dataset?: {
    private_schema?: unknown
    private_schemas?: unknown[]
    private_relations?: unknown[]
    private_routines?: unknown[]
  }
}

export function loadTargetAuthoritySnapshot(): AuthoritySnapshot {
  const ref = process.env.MOMI_DEV_REF ?? "origin/dev"
  if (ref !== "origin/dev" && !/^[0-9a-f]{40}$/.test(ref)) {
    throw new Error("MOMI_DEV_REF must be origin/dev or a full commit SHA")
  }
  const listing = spawnSync(
    "git",
    ["ls-tree", "-r", "--name-only", ref, "--", "services"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  )
  if (listing.error) throw listing.error
  if (listing.status !== 0) {
    throw new Error("Unable to list services on the trusted development ref")
  }
  const relationOwners = new Map<string, string>()
  const routineOwners = new Map<string, string>()
  const schemaOwners = new Map<string, Set<string>>()
  const paths = listing.stdout.split("\n").filter((path) =>
    /^services\/[a-z][a-z0-9-]+\/service\.json$/.test(path)
  )
  for (const path of paths) {
    const result = spawnSync("git", ["show", `${ref}:${path}`], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
      throw new Error(`Unable to read ${path} on the trusted development ref`)
    }
    let manifest: SnapshotManifest
    try {
      manifest = JSON.parse(result.stdout)
    } catch {
      throw new Error(`${path} on the trusted development ref is not valid JSON`)
    }
    const key = manifest.service_key
    if (typeof key !== "string") throw new Error(`${path} has no service_key`)
    const dataset = manifest.owned_dataset
    const schemas = new Set<unknown>([
      ...(dataset?.private_schema ? [dataset.private_schema] : []),
      ...(dataset?.private_schemas ?? []),
      ...(dataset?.private_relations ?? []).map((value) =>
        typeof value === "string" ? value.split(".")[0] : value
      ),
      ...(dataset?.private_routines ?? []).map((value) =>
        typeof value === "string" ? value.split(".")[0] : value
      ),
    ])
    for (const schema of schemas) {
      if (typeof schema !== "string") throw new Error(`${path} has invalid schemas`)
      const owners = schemaOwners.get(schema) ?? new Set<string>()
      owners.add(key)
      schemaOwners.set(schema, owners)
    }
    for (const relation of dataset?.private_relations ?? []) {
      if (typeof relation !== "string") throw new Error(`${path} has invalid relations`)
      relationOwners.set(relation, key)
    }
    for (const routine of dataset?.private_routines ?? []) {
      if (typeof routine !== "string") throw new Error(`${path} has invalid routines`)
      routineOwners.set(routine, key)
    }
  }
  return { relationOwners, routineOwners, schemaOwners }
}
