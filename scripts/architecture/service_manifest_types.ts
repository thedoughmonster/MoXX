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
  private_schema?: string
  private_relations: string[]
  public_reads?: string[]
  public_commands?: string[]
  emitted_events?: string[]
  db_role?: string
}
