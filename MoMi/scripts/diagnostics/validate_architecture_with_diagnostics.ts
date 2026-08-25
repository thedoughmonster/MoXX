import { validateArchitecture } from "../architecture/validate_architecture.ts"
import type { Architecture } from "../architecture/types.ts"
import { renderRepositoryDiagnostics } from "./render_repository_diagnostics.ts"
import { RepositoryDiagnosticError } from "./repository_diagnostic_error.ts"

export async function validateArchitectureWithDiagnostics(): Promise<Architecture> {
  try {
    return await validateArchitecture()
  } catch (error) {
    if (error instanceof RepositoryDiagnosticError) {
      throw new Error(
        `Architecture violations:\n${renderRepositoryDiagnostics(
          error.diagnostics,
        ).trimEnd()}`,
      )
    }
    throw error
  }
}
