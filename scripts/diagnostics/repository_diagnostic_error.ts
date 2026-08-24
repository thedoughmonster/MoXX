import type { RepositoryDiagnosticV1 } from "./types.ts"

export class RepositoryDiagnosticError extends Error {
  readonly diagnostics: RepositoryDiagnosticV1[]

  constructor(message: string, diagnostics: RepositoryDiagnosticV1[]) {
    super(message)
    this.name = "RepositoryDiagnosticError"
    this.diagnostics = diagnostics
  }
}
