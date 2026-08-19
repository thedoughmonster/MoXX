import type {
  DatabaseCapabilityMode,
  DatabaseObjectAuthority,
  DatabaseObjectAuthorityDiagnostic,
  DatabaseObjectIdentity,
} from "./database_object_authority_types.ts"
import type {
  ExecutionAuthority,
  ExecutionAuthorityContext,
} from "./execution_authority_types.ts"

export type ExecutionAuthorityV2 = Omit<
  ExecutionAuthority, "schema_version" | "database"
> & {
  schema_version: "execution-authority/v2"
  database: {
    authority: {
      repository: string
      revision: string
      source_digest: string
      authority_digest: string
    }
    capabilities: Array<{
      object: DatabaseObjectIdentity
      mode: DatabaseCapabilityMode
    }>
  }
}

export type ExecutionAuthorityV2Context = ExecutionAuthorityContext & {
  databaseObjectAuthority: DatabaseObjectAuthority
  databaseObjectAuthoritySchema: object
  databaseObjectAuthorityDiagnostics: DatabaseObjectAuthorityDiagnostic[]
}
