import { replayRoutineDefinitions } from "./replay_routine_definitions.ts"

export function replayRoutineInventory(migrations: Map<string, string>): Set<string> {
  return new Set(
    [...replayRoutineDefinitions(migrations).values()]
      .map((definition) => definition.name).sort(),
  )
}
