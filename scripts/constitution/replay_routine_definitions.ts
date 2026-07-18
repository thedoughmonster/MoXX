import { collectRoutineActions } from "./collect_routine_actions.ts"
import { collectRelationActions } from "./collect_relation_actions.ts"
import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { rewriteSqlObjectReference } from
  "../sql/rewrite_sql_object_reference.ts"
import { rewriteSqlSchemaReference } from
  "../sql/rewrite_sql_schema_reference.ts"

export type RoutineDefinition = {
  identity: string
  name: string
  source: string
}

export function replayRoutineDefinitions(
  migrations: Map<string, string>,
): Map<string, RoutineDefinition> {
  const definitions = new Map<string, RoutineDefinition>()
  for (const [file, source] of migrations) {
    const actions = [
      ...collectRoutineActions(file, source).map((action) => ({ action, kind: "routine" })),
      ...collectRelationActions(file, source)
        .filter((action) => ["move", "rename", "rename_schema"].includes(action.operation))
        .map((action) => ({ action, kind: "relation" })),
    ].sort((left, right) => left.action.index - right.action.index)
    for (const item of actions) {
      const action = item.action
      if (item.kind === "relation") {
        for (const definition of definitions.values()) {
          if (!/\bbegin\s+atomic\b/i.test(definition.source)) continue
          if (action.operation === "rename_schema") {
            definition.source = rewriteSqlSchemaReference(
              definition.source, action.name, action.target!,
            )
          } else {
            const [schema, relation] = action.name.split(".")
            const after = action.operation === "move"
              ? `${action.target}.${relation}`
              : `${schema}.${action.target}`
            definition.source = rewriteSqlObjectReference(
              definition.source, action.name, after,
            )
          }
        }
        continue
      }
      const name = action.name.toLowerCase()
      if (action.operation === "create") definitions.set(action.identity!, {
        identity: action.identity!, name,
        source: normalizeSqlIdentifiers(action.source!),
      })
      if (action.operation === "drop") {
        if (action.identity) definitions.delete(action.identity)
        else for (const [identity, definition] of definitions) {
          if (definition.name === name) definitions.delete(identity)
        }
      }
      if (action.operation === "drop_schema") {
        for (const [identity, definition] of definitions) {
          if (definition.name.startsWith(`${name}.`)) definitions.delete(identity)
        }
      }
      if (action.operation === "rename_schema") {
        for (const [identity, definition] of [...definitions]) {
          if (!definition.name.startsWith(`${name}.`)) continue
          const renamed = `${action.target}.${definition.name.slice(name.length + 1)}`
          const renamedIdentity = `${renamed}${identity.slice(definition.name.length)}`
          definitions.delete(identity)
          definitions.set(renamedIdentity, {
            ...definition, identity: renamedIdentity, name: renamed,
          })
        }
      }
    }
  }
  return new Map([...definitions].sort(([left], [right]) => left.localeCompare(right)))
}
