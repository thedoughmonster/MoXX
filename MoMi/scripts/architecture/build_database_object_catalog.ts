import { replayRelationInventory } from
  "../constitution/replay_relation_inventory.ts"
import { replayRoutineDefinitions } from
  "../constitution/replay_routine_definitions.ts"
import type {
  DatabaseObjectAuthorityRevision,
  DatabaseObjectCatalog,
  DatabaseObjectIdentity,
} from "./database_object_authority_types.ts"

export function buildDatabaseObjectCatalog(
  source: DatabaseObjectAuthorityRevision,
): DatabaseObjectCatalog {
  const migrations = new Map(source.migrations.map((item) =>
    [item.path, item.source]))
  const relations = replayRelationInventory(migrations)
  for (const evidence of source.external_relations) {
    if (!relations.has(evidence.identity)) {
      relations.set(evidence.identity, "table")
    }
  }
  const routines = new Map<string, Array<Extract<
    DatabaseObjectIdentity, { class: "routine" }
  >>>()
  for (const definition of replayRoutineDefinitions(migrations).values()) {
    const [schema, name] = definition.name.split(".")
    const prefix = `${definition.name}(`
    const signature = definition.identity.startsWith(prefix)
      ? definition.identity.slice(prefix.length, -1)
      : ""
    const identity = { class: "routine" as const, schema: schema!, name: name!,
      arguments: signature === "" ? [] : signature.split(",") }
    routines.set(definition.name, [...(routines.get(definition.name) ?? []),
      identity])
  }
  return { relations, routines }
}
