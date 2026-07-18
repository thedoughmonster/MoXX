import type { IndexAction } from "./collect_index_actions.ts"

export type IndexDefinition = { name: string; relation: string }

export function applyIndexAction(
  inventory: Map<string, IndexDefinition>,
  action: IndexAction,
  file: string,
): void {
  if (action.operation === "create") {
    inventory.set(action.name, { name: action.name, relation: action.relation! })
    return
  }
  const definition = inventory.get(action.name)
  if (!definition) throw new Error(`${file}: cannot ${action.operation} unknown index ${action.name}`)
  if (action.operation === "drop") {
    inventory.delete(action.name)
    return
  }
  if (action.operation === "mutate") return
  const schema = action.name.split(".")[0]
  const name = action.name.split(".")[1]
  const target = action.operation === "move"
    ? `${action.target}.${name}`
    : `${schema}.${action.target}`
  inventory.delete(action.name)
  inventory.set(target, { ...definition, name: target })
}
