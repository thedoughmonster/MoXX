import { collectRelationActions } from "./collect_relation_actions.ts"
import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { rewriteSqlObjectReference } from
  "../sql/rewrite_sql_object_reference.ts"
import type { RelationKind } from "./replay_relation_inventory.ts"

export type RelationDefinition = { kind: RelationKind; source: string }

export function replayRelationDefinitions(
  migrations: Map<string, string>,
): Map<string, RelationDefinition> {
  const definitions = new Map<string, RelationDefinition>()
  const rewrite = (before: string, after: string): void => {
    for (const definition of definitions.values()) {
      if (definition.kind === "table") continue
      definition.source = rewriteSqlObjectReference(definition.source, before, after)
    }
  }
  for (const [file, source] of migrations) {
    for (const action of collectRelationActions(file, source)) {
      const name = action.name.toLowerCase()
      const target = action.target?.toLowerCase()
      if (action.operation === "rename_schema") {
        for (const [relation, definition] of [...definitions]) {
          if (!relation.startsWith(`${name}.`)) continue
          const after = `${target}.${relation.slice(name.length + 1)}`
          rewrite(relation, after)
          definitions.delete(relation)
          definitions.set(after, definition)
        }
      } else if (action.operation === "drop_schema") {
        for (const relation of [...definitions.keys()]) {
          if (relation.startsWith(`${name}.`)) definitions.delete(relation)
        }
      } else if (action.operation === "create") {
        definitions.set(name, {
          kind: action.kind!, source: normalizeSqlIdentifiers(action.source!),
        })
      } else if (action.operation === "drop") definitions.delete(name)
      else if (action.operation === "move" || action.operation === "rename") {
        const definition = definitions.get(name)
        if (!definition) {
          throw new Error(`${file}: cannot ${action.operation} unknown relation ${name}`)
        }
        const [beforeSchema, relation] = name.split(".")
        const after = action.operation === "move"
          ? `${target}.${relation}`
          : `${beforeSchema}.${target}`
        rewrite(name, after)
        definitions.delete(name)
        definitions.set(after, definition)
      }
    }
  }
  return new Map([...definitions].sort(([left], [right]) => left.localeCompare(right)))
}
