import type { LoadedService, SourceModule } from "../architecture/types.ts"

export function isDeclaredDynamicRead(
  owner: LoadedService | undefined,
  services: LoadedService[],
  module: SourceModule,
  subject: string,
  source: string,
): boolean {
  if (!owner || !module.path.endsWith(".sql") ||
    (source.match(/\bexecute\s+(?!on\b)/giu) ?? []).length !== 1) return false
  for (const declaration of owner.manifest.owned_dataset?.dynamic_read_routines ?? []) {
    const prefix = `database/routines/${declaration.routine}--`
    if (!subject.startsWith(prefix) ||
      !declaration.routine.startsWith(`${declaration.schema}.`) ||
      !owner.manifest.owned_dataset?.private_routines?.includes(declaration.routine) ||
      !owner.manifest.owned_dataset?.public_routine_reads?.some((entry) =>
        entry.contract === declaration.contract && entry.routine === declaration.routine
      )) continue
    const consumer = services.find((service) =>
      service.manifest.service_key === declaration.consumer_service
    )
    if (consumer?.manifest.owned_dataset?.db_role !== declaration.role ||
      !consumer.manifest.contracts.consumes.some((entry) =>
        entry.service === owner.manifest.service_key &&
        entry.contract === declaration.contract
      )) continue
    const normalized = source.toLowerCase()
    if (normalized.includes("security definer") ||
      !normalized.includes("security invoker") ||
      !normalized.includes("transaction_read_only") ||
      !normalized.includes(`current_user <> '${declaration.role}'`) ||
      !normalized.includes(`set search_path = pg_catalog, ${declaration.schema}`)) continue
    return true
  }
  return false
}
