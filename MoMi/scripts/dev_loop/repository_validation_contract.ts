export const repositoryCheckScripts = [
  "check_dev_branch_clean.ts",
  "check_architecture.ts",
  "check_service_constitution.ts",
  "check_catalog.ts",
  "check_source_quality.ts",
  "check_quality_report_validity.ts",
  "check_migrations.ts",
  "check_edge_functions.ts",
]

export const repositoryHardCheckIds = repositoryCheckScripts.map((script) =>
  script.replace(/^check_|\.ts$/gu, "")
).concat("tests")
