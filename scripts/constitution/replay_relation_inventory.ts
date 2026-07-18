import { collectRelationActions } from "./collect_relation_actions.ts"

export type RelationKind = "table" | "view" | "materialized view"

export function replayRelationInventory(
  migrations: Map<string, string>,
): Map<string, RelationKind> {
  const inventory = new Map<string, RelationKind>()
  for (const [file, source] of migrations) {
    for (const action of collectRelationActions(file, source)) {
      const name = action.name.toLowerCase()
      const target = action.target?.toLowerCase()
      if (action.operation === "rename_schema") {
        for (const [relation, kind] of [...inventory]) {
          if (!relation.startsWith(`${name}.`)) continue
          inventory.delete(relation)
          inventory.set(`${target}.${relation.slice(name.length + 1)}`, kind)
        }
      } else if (action.operation === "drop_schema") {
        for (const relation of [...inventory.keys()]) {
          if (relation.startsWith(`${name}.`)) inventory.delete(relation)
        }
      } else if (action.operation === "create") {
        inventory.set(name, action.kind!)
      } else if (action.operation === "drop") inventory.delete(name)
      else if (action.operation === "move" || action.operation === "rename") {
        const kind = inventory.get(name)
        if (!kind) throw new Error(`${file}: cannot ${action.operation} unknown relation ${name}`)
        const [beforeSchema, relation] = name.split(".")
        const after = action.operation === "move"
          ? `${target}.${relation}`
          : `${beforeSchema}.${target}`
        inventory.delete(name)
        inventory.set(after, kind)
      }
    }
  }
  return new Map([...inventory].sort(([left], [right]) => left.localeCompare(right)))
}
