import type { LoadedService } from "../architecture/types.ts"

export type RoutineAuthority = {
  names: Map<string, string[]>
  ownedSchemas: Set<string>
  owners: Map<string, string>
  publicRoutines: Map<string, Array<{ contract: string; service: string }>>
}

export function buildRoutineAuthority(services: LoadedService[]): RoutineAuthority {
  const names = new Map<string, string[]>()
  const ownedSchemas = new Set<string>()
  const owners = new Map<string, string>()
  const publicRoutines = new Map<string, Array<{ contract: string; service: string }>>()
  for (const service of services) {
    const key = service.manifest.service_key
    const dataset = service.manifest.owned_dataset
    if (dataset?.private_schema) ownedSchemas.add(dataset.private_schema)
    for (const schema of dataset?.private_schemas ?? []) ownedSchemas.add(schema)
    for (const relation of dataset?.private_relations ?? []) {
      ownedSchemas.add(relation.split(".")[0])
    }
    for (const routine of dataset?.private_routines ?? []) {
      owners.set(routine, key)
      ownedSchemas.add(routine.split(".")[0])
      const name = routine.split(".")[1]
      const routines = names.get(name) ?? []
      routines.push(routine)
      names.set(name, routines)
    }
    for (const artifact of [
      ...(dataset?.public_routine_reads ?? []),
      ...(dataset?.public_routine_commands ?? []),
    ]) {
      const entries = publicRoutines.get(artifact.routine) ?? []
      entries.push({ contract: artifact.contract, service: key })
      publicRoutines.set(artifact.routine, entries)
    }
  }
  return { names, ownedSchemas, owners, publicRoutines }
}
