import { collectRelationActions } from
  "../constitution/collect_relation_actions.ts"
import { applyIndexAction, type IndexDefinition } from "./apply_index_action.ts"
import { applyRelationActionToIndexes } from
  "./apply_relation_action_to_indexes.ts"
import { collectIndexActions } from "./collect_index_actions.ts"

export function replayIndexInventory(
  migrations: Map<string, string>,
): Map<string, IndexDefinition> {
  const inventory = new Map<string, IndexDefinition>()
  for (const [file, source] of migrations) {
    const actions = [
      ...collectIndexActions(file, source).map((action) => ({ action, type: "index" })),
      ...collectRelationActions(file, source).map((action) => ({ action, type: "relation" })),
    ].sort((left, right) => left.action.index - right.action.index)
    for (const item of actions) {
      if (item.type === "index") {
        applyIndexAction(inventory, item.action as never, file)
      } else applyRelationActionToIndexes(inventory, item.action as never)
    }
  }
  return new Map([...inventory].sort(([left], [right]) => left.localeCompare(right)))
}
