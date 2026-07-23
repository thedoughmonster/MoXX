import type { LoadedService } from "../architecture/types.ts"
import { isDeclaredDynamicRead } from
  "../constitution/is_declared_dynamic_read.ts"

export function hasDeclaredDynamicMigrationRead(
  owner: LoadedService,
  services: LoadedService[],
  source: string,
): boolean {
  return owner.manifest.owned_dataset?.dynamic_read_routines?.some((entry) =>
    isDeclaredDynamicRead(owner, services, {
      path: `${entry.routine}.sql`, service_key: owner.manifest.service_key,
      source, imports: [],
    }, `database/routines/${entry.routine}--migration.sql`, source)
  ) ?? false
}
