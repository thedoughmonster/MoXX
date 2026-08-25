import type {
  ProviderObservedShape,
  ProviderParseDiagnostic,
  ProviderParseSubreason,
} from "./provider_parse_diagnostic.ts"

export class ProviderSchemaError extends Error {
  readonly diagnostic: ProviderParseDiagnostic

  constructor(subreason: ProviderParseSubreason, observed: ProviderObservedShape) {
    super(`Provider schema rejected: ${subreason}`)
    this.name = "ProviderSchemaError"
    this.diagnostic = Object.freeze({ subreason, ...observed })
  }
}
