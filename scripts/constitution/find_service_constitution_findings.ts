import type { ConstitutionFinding } from "./types.ts"
import type { LoadedService } from "../architecture/types.ts"
import { finalizeFindings } from "./finalize_findings.ts"
import { findGlobalDeclarationFindings } from
  "./find_global_declaration_findings.ts"
import { findRelationInventoryFindings } from
  "./find_relation_inventory_findings.ts"
import { findServiceDeclarationFindings } from
  "./find_service_declaration_findings.ts"

export function findServiceConstitutionFindings(
  services: LoadedService[],
  relationInventory?: Map<string, string>,
): ConstitutionFinding[] {
  return finalizeFindings([
    ...findServiceDeclarationFindings(services),
    ...findGlobalDeclarationFindings(services),
    ...(relationInventory
      ? findRelationInventoryFindings(services, relationInventory)
      : []),
  ])
}
