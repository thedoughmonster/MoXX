import { collectRelationActions } from
  "../constitution/collect_relation_actions.ts"
import { applyIndexAction } from "./apply_index_action.ts"
import { applyRelationActionToIndexes } from
  "./apply_relation_action_to_indexes.ts"
import { collectIndexActions } from "./collect_index_actions.ts"
import { replayIndexInventory } from "./replay_index_inventory.ts"

export function findIndexAuthorityViolations(
  baseline: Map<string, string>,
  current: Map<string, string>,
  relationOwners: Map<string, string>,
): string[] {
  const accepted = new Map(
    [...current].filter(([file]) => baseline.has(file)),
  )
  const inventory = replayIndexInventory(accepted)
  const violations: string[] = []
  for (const [file, source] of current) {
    if (baseline.has(file)) continue
    const actor = source.match(/^-- service-owner: ([a-z][a-z0-9-]+)$/m)?.[1]
    if (!actor) continue
    const actions = [
      ...collectIndexActions(file, source).map((action) => ({ action, type: "index" })),
      ...collectRelationActions(file, source).map((action) => ({ action, type: "relation" })),
    ].sort((left, right) => left.action.index - right.action.index)
    for (const item of actions) {
      if (item.type === "relation") {
        applyRelationActionToIndexes(inventory, item.action as never)
        continue
      }
      const action = item.action as ReturnType<typeof collectIndexActions>[number]
      const definition = action.operation === "create"
        ? { name: action.name, relation: action.relation! }
        : inventory.get(action.name)
      if (!definition) {
        violations.push(`${file}: index authority is unknown for ${action.name}`)
      } else {
        const owner = relationOwners.get(definition.relation)
        if (!owner) violations.push(
          `${file}: index ${action.name} targets unowned relation ${definition.relation}`,
        )
        else if (owner !== actor) violations.push(
          `${file}: ${actor} cannot mutate index ${action.name} on ` +
            `${definition.relation} owned by ${owner}`,
        )
      }
      applyIndexAction(inventory, action, file)
    }
  }
  return violations.sort()
}
