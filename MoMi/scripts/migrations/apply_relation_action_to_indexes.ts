import type { RelationAction } from
  "../constitution/collect_relation_actions.ts"
import type { IndexDefinition } from "./apply_index_action.ts"

export function applyRelationActionToIndexes(
  inventory: Map<string, IndexDefinition>,
  action: RelationAction,
): void {
  const name = action.name.toLowerCase()
  const target = action.target?.toLowerCase()
  for (const [index, definition] of [...inventory]) {
    if (action.operation === "drop" && definition.relation === name) {
      inventory.delete(index)
    } else if (action.operation === "drop_schema" &&
      (index.startsWith(`${name}.`) || definition.relation.startsWith(`${name}.`))) {
      inventory.delete(index)
    } else if (action.operation === "rename_schema" &&
      (index.startsWith(`${name}.`) || definition.relation.startsWith(`${name}.`))) {
      const nextIndex = index.startsWith(`${name}.`)
        ? `${target}.${index.slice(name.length + 1)}` : index
      const nextRelation = definition.relation.startsWith(`${name}.`)
        ? `${target}.${definition.relation.slice(name.length + 1)}`
        : definition.relation
      inventory.delete(index)
      inventory.set(nextIndex, { name: nextIndex, relation: nextRelation })
    } else if ((action.operation === "move" || action.operation === "rename") &&
      definition.relation === name) {
      const [schema, relation] = name.split(".")
      const nextRelation = action.operation === "move"
        ? `${target}.${relation}` : `${schema}.${target}`
      const nextIndex = action.operation === "move"
        ? `${target}.${index.split(".")[1]}` : index
      inventory.delete(index)
      inventory.set(nextIndex, { name: nextIndex, relation: nextRelation })
    }
  }
}
