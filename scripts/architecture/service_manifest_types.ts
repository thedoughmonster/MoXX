export type ServiceType =
  | "procurement_adapter"
  | "transform"
  | "raw_evidence_archive"
  | "event_router"
  | "dataset_owner"
  | "read_facade"
  | "destination_adapter"

export type OwnedDataset = {
  dataset_key: string
  dataset_class: "domain" | "operational" | "raw_evidence"
  private_schema?: string
  private_schemas?: string[]
  private_relations: string[]
  private_routines?: string[]
  public_reads?: string[]
  public_relation_reads?: PublicRelationRead[]
  public_commands?: string[]
  public_routine_reads?: PublicRoutineCommand[]
  public_routine_commands?: PublicRoutineCommand[]
  emitted_events?: string[]
  db_role?: string
}

export type PublicRelationRead = {
  contract: string
  relation: string
}

export type PublicRoutineCommand = {
  contract: string
  routine: string
}

export type DeploymentUnitKind =
  | "database_processor"
  | "cron_job"
  | "queue"
  | "event_subscription"
  | "postgres_extension"
  | "vault_secret"

export type DeploymentUnit = {
  kind: DeploymentUnitKind
  key: string
}

export type ServiceDeployment = {
  owns: DeploymentUnit[]
  depends_on: DeploymentUnit[]
}
