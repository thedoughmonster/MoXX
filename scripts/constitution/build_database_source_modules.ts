import { createHash } from "node:crypto"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { LoadedService, SourceModule } from "../architecture/types.ts"
import type { RelationDefinition } from "./replay_relation_definitions.ts"
import type { RoutineDefinition } from "./replay_routine_definitions.ts"

export function buildDatabaseSourceModules(
  services: LoadedService[],
  relations: Map<string, RelationDefinition>,
  routines: Map<string, RoutineDefinition>,
): SourceModule[] {
  const relationOwners = new Map<string, string>()
  const routineOwners = new Map<string, string>()
  for (const service of services) {
    const key = service.manifest.service_key
    for (const relation of service.manifest.owned_dataset?.private_relations ?? []) {
      relationOwners.set(relation, key)
    }
    for (const routine of service.manifest.owned_dataset?.private_routines ?? []) {
      routineOwners.set(routine, key)
    }
  }
  const modules: SourceModule[] = []
  for (const [relation, definition] of relations) {
    const owner = relationOwners.get(relation)
    if (!owner || definition.kind === "table") continue
    modules.push({
      path: join(workspaceRoot, "database", "views", `${relation}.sql`),
      service_key: owner,
      source: definition.source,
      imports: [],
    })
  }
  for (const definition of routines.values()) {
    const owner = routineOwners.get(definition.name)
    if (!owner) continue
    const suffix = createHash("sha256").update(definition.identity)
      .digest("hex").slice(0, 12)
    modules.push({
      path: join(
        workspaceRoot,
        "database",
        "routines",
        `${definition.name}--${suffix}.sql`,
      ),
      service_key: owner,
      source: definition.source,
      imports: [],
    })
  }
  return modules.sort((left, right) => left.path.localeCompare(right.path))
}
