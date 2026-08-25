import type { LoadedService } from "../architecture/types.ts"

export type ForeignSchemaAuthorityChange = {
  owner_services: string
  schema: string
}

export function findForeignSchemaAuthorityChanges(
  source: string,
  services: LoadedService[],
  actor: string,
  trustedOwners?: Map<string, Set<string>>,
): ForeignSchemaAuthorityChange[] {
  const ownersBySchema = new Map<string, Set<string>>()
  for (const service of services) {
    const key = service.manifest.service_key
    const dataset = service.manifest.owned_dataset
    const schemas = new Set([
      ...(dataset?.private_schema ? [dataset.private_schema] : []),
      ...(dataset?.private_schemas ?? []),
      ...(dataset?.private_relations ?? []).map((relation) => relation.split(".")[0]),
      ...(dataset?.private_routines ?? []).map((routine) => routine.split(".")[0]),
    ])
    for (const schema of schemas) {
      const owners = ownersBySchema.get(schema) ?? new Set<string>()
      owners.add(key)
      ownersBySchema.set(schema, owners)
    }
  }
  for (const [schema, owners] of trustedOwners ?? []) {
    ownersBySchema.set(schema, new Set(owners))
  }
  const changes: ForeignSchemaAuthorityChange[] = []
  for (const [schema, owners] of ownersBySchema) {
    if (owners.size === 1 && owners.has(actor)) continue
    const escaped = schema.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const patterns = [
      `\\b(?:create|alter)\\s+schema\\s+` +
        `(?:if\\s+(?:not\\s+)?exists\\s+)?${escaped}\\b`,
      `\\bdrop\\s+schema\\b[^;]*\\b${escaped}\\b`,
      `\\b(?:comment\\s+on|security\\s+label\\s+on)\\s+schema\\s+${escaped}\\b`,
      `\\b(?:grant|revoke)\\b[^;]*\\bon\\s+schema\\s+[^;]*\\b${escaped}\\b`,
      `\\b(?:grant|revoke)\\b[^;]*\\bin\\s+schema\\s+${escaped}\\b`,
      `\\balter\\s+default\\s+privileges\\b[^;]*\\bin\\s+schema\\s+${escaped}\\b`,
      `\\bset(?:\\s+local)?\\s+search_path\\s*(?:to|=)[^;\\r\\n]*\\b${escaped}\\b`,
      `\\bset(?:\\s+local)?\\s+schema\\s+['"]?${escaped}\\b`,
      `\\bset_config\\s*\\(\\s*['\"]search_path['\"][^;)]*\\b${escaped}\\b`,
      `\\bcreate\\s+extension\\b[^;]*\\bschema\\s+${escaped}\\b`,
    ]
    if (!patterns.some((pattern) => new RegExp(pattern, "i").test(source))) continue
    changes.push({
      owner_services: [...owners].sort().join(","),
      schema,
    })
  }
  return changes.sort((left, right) => left.schema.localeCompare(right.schema))
}
