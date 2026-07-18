import type { ConstitutionFinding } from "./types.ts"
import type { LoadedService } from "../architecture/types.ts"
import { finalizeFindings } from "./finalize_findings.ts"
import { findGlobalDeclarationFindings } from
  "./find_global_declaration_findings.ts"
import { findDatasetClassFindings } from "./find_dataset_class_findings.ts"
import { findPublicRelationReadFindings } from
  "./find_public_relation_read_findings.ts"
import { findPublicRoutineCommandFindings } from
  "./find_public_routine_command_findings.ts"
import { findRelationInventoryFindings } from
  "./find_relation_inventory_findings.ts"
import { findRoutineInventoryFindings } from
  "./find_routine_inventory_findings.ts"
import { findServiceDeclarationFindings } from
  "./find_service_declaration_findings.ts"

export function findServiceConstitutionFindings(
  services: LoadedService[],
  relationInventory?: Map<string, string>,
  routineInventory?: Set<string>,
): ConstitutionFinding[] {
  return finalizeFindings([
    ...findServiceDeclarationFindings(services),
    ...findDatasetClassFindings(services),
    ...findGlobalDeclarationFindings(services),
    ...findPublicRelationReadFindings(services, relationInventory),
    ...findPublicRoutineCommandFindings(services, routineInventory),
    ...(relationInventory
      ? findRelationInventoryFindings(services, relationInventory)
      : []),
    ...(routineInventory
      ? findRoutineInventoryFindings(services, routineInventory)
      : []),
  ])
}
