export type MigrationDiagnosticRule = {
  rule_id: string
  violated_rule: string
  expected: string
}

export type MigrationDiagnosticPhase =
  | "violation"
  | "inventory"
  | "production_baseline"
  | "development_baseline"
  | "correction_ledger"
  | "development_history"
  | "authority_snapshot"
  | "authority_validation"

export function classifyMigrationViolation(
  detail: string,
): MigrationDiagnosticRule {
  let rule_id = "MIGRATION_VALIDATION_FAILURE"
  let violated_rule = "Migration validation must complete from repository-owned inputs."
  let expected = "Correct the reported input or unsupported syntax, then rerun validation."
  if (/unknown service owner/u.test(detail)) {
    rule_id = "MIGRATION_SERVICE_OWNER_HEADER"
    violated_rule = "Every new migration must declare one valid service owner on line 1."
    expected = "Replace the header value with an existing service_key from a service manifest."
  } else if (/service-owner/u.test(detail)) {
    rule_id = "MIGRATION_SERVICE_OWNER_HEADER"
    violated_rule = "Every new migration must declare one valid service owner on line 1."
    expected = "Place exactly -- service-owner: <service-key> on physical line 1."
  } else if (/Invalid (?:development )?migration correction|migration replacement does not match correction|duplicate development migration replacement/u
    .test(detail)) {
    rule_id = "MIGRATION_CORRECTION_LEDGER"
    violated_rule = "Development migration corrections must satisfy the ledger contract."
    expected = "Correct the invalid entry in the development migration correction ledger."
  } else if (/\bmigration\b.*\b(?:deleted|modified|re-added|changed|replacement)\b/u
    .test(detail)) {
    rule_id = "MIGRATION_HISTORY_IMMUTABILITY"
    violated_rule = "Production and trusted development migration history is immutable."
    expected = "Restore the trusted path and bytes; express changes in a new migration."
  } else if (/trusted development ref|has no service_key|has invalid (?:schemas|relations|routines)/u
    .test(detail)) {
    rule_id = "MIGRATION_TRUSTED_AUTHORITY_SNAPSHOT"
    violated_rule = "Migration authority must load from valid trusted-dev service metadata."
    expected = "Restore the trusted ref or correct the reported trusted service manifest."
  } else if (/unsupported .*?(?:DDL|target|argument)|routine .*?(?:argument list)/u
    .test(detail)) {
    rule_id = "MIGRATION_SUPPORTED_PERSISTENT_DDL"
    violated_rule = "Persistent DDL must use forms supported by the authority model."
    expected = "Rewrite the reported statement or target with supported persistent DDL."
  } else if (/cannot .* unknown index|index authority is unknown for/u.test(detail)) {
    rule_id = "MIGRATION_INDEX_INVENTORY"
    violated_rule = "Index mutations must target an index known at that history position."
    expected = "Correct the index name or order its creating migration before this mutation."
  } else if (/index/u.test(detail)) {
    rule_id = "MIGRATION_INDEX_AUTHORITY"
    violated_rule = "Index authority follows the exact indexed relation owner."
    expected = "Mutate the index only from a migration owned by its relation owner."
  } else if (/schema-qualified/u.test(detail)) {
    rule_id = "MIGRATION_REFERENCE_QUALIFICATION"
    violated_rule = "Known database objects must be schema-qualified in migrations."
    expected = "Qualify the reported object with its authoritative schema."
  } else if (/routine/u.test(detail)) {
    rule_id = "MIGRATION_ROUTINE_AUTHORITY"
    violated_rule = "Routine use and mutation must follow declared routine authority."
    expected = "Use the qualified owned routine or its declared public contract."
  } else if (/Unicode SQL identifiers/u.test(detail)) {
    rule_id = "MIGRATION_IDENTIFIER_SAFETY"
    violated_rule = "Migration SQL identifiers must use the supported plain form."
    expected = "Replace the Unicode identifier form with a supported SQL identifier."
  } else if (/role and ownership/u.test(detail)) {
    rule_id = "MIGRATION_ROLE_AUTHORITY"
    violated_rule = "Unmodeled role and ownership authority changes are forbidden."
    expected = "Remove the role change or first model its authority in repository metadata."
  } else if (/migration inventory|migration must|unexpected (?:production )?migration|duplicate (?:production )?migration/u
    .test(detail)) {
    rule_id = "MIGRATION_INVENTORY_SHAPE"
    violated_rule = "The migration inventory must remain flat, regular, and SQL-only."
    expected = "Correct the reported path to the repository migration inventory shape."
  } else if (/MOMI_|(?:[Pp]roduction|development) migration baseline|development migration history/u
    .test(detail)) {
    rule_id = "MIGRATION_VALIDATION_INPUT"
    violated_rule = "Migration validation must use the declared repository baselines."
    expected = "Restore the declared validation ref, baseline, or history input."
  } else if (/while ownership transfers/u.test(detail)) {
    rule_id = "MIGRATION_OWNERSHIP_TRANSFER_SEQUENCE"
    violated_rule = "An ownership transfer must land before its new owner mutates the object."
    expected = "Land the manifest-only ownership transfer in an earlier change."
  } else if (/change authority for schema/u.test(detail)) {
    rule_id = "MIGRATION_SCHEMA_AUTHORITY"
    violated_rule = "Schema authority changes belong only to declared schema owners."
    expected = "Move the schema change to its declared owner or remove it."
  } else if (/dynamic SQL relation authority/u.test(detail)) {
    rule_id = "MIGRATION_DYNAMIC_SQL_AUTHORITY"
    violated_rule = "Dynamic relation access requires an explicitly declared authority model."
    expected = "Use static qualified SQL or declare the supported dynamic-read contract."
  } else if (/cannot (?:read|write|mutate|call|use)|unowned relation/u.test(detail)) {
    rule_id = "MIGRATION_OWNER_AUTHORITY"
    violated_rule = "A migration may act only within its declared service authority."
    expected = "Limit the migration to its owner's objects and consumed public contracts."
  }
  return { rule_id, violated_rule, expected }
}
