export type FixId =
  | "catalog"
  | "debt-lifecycle"
  | "legacy-access-report"
  | "quality"

export type FixRegistration = {
  id: FixId
  outputs: readonly string[]
  script: string
  validation_command: string
}

export type FixReceipt = {
  changed_paths: string[]
  delegated_command: string
  fix_id: FixId
  validation_command: string
}

export type FileInventory = Map<string, string>
