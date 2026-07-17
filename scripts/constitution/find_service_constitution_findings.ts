import type { ConstitutionFinding } from "./types.ts"
import type { LoadedService } from "../architecture/types.ts"
import { finalizeFindings } from "./finalize_findings.ts"
import { findGlobalDeclarationFindings } from
  "./find_global_declaration_findings.ts"
import { findServiceDeclarationFindings } from
  "./find_service_declaration_findings.ts"

export function findServiceConstitutionFindings(
  services: LoadedService[],
): ConstitutionFinding[] {
  return finalizeFindings([
    ...findServiceDeclarationFindings(services),
    ...findGlobalDeclarationFindings(services),
  ])
}
