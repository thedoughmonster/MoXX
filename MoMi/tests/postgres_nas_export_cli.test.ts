import assert from "node:assert/strict"
import test from "node:test"

import { buildDumpArgs } from "../local-tools/postgres-nas-export/build_dump_args.ts"
import { buildPortableDumpArgs } from
  "../local-tools/postgres-nas-export/build_portable_dump_args.ts"
import { buildRestoreArgs } from "../local-tools/postgres-nas-export/build_restore_args.ts"
import { currentQuarter } from "../local-tools/postgres-nas-export/current_quarter.ts"
import { parseCli } from "../local-tools/postgres-nas-export/parse_cli.ts"
import { selectPortableSchemas } from
  "../local-tools/postgres-nas-export/select_portable_schemas.ts"
import { validateRequest } from "../local-tools/postgres-nas-export/validate_request.ts"
import type { WorkspaceConfig } from "../local-tools/postgres-nas-export/types.ts"

const projectRef = "abcdefghijklmnopqrst"
const common = ["--env", "prod", "--project-ref", projectRef, "--target", "\\\\nas01\\momi"]
const workspace: WorkspaceConfig = {
  schema_version: 1,
  environments: { dev: { project_ref: "tsrqponmlkjihgfedcba" }, prod: { project_ref: projectRef } },
  database_schemas: [
    "toast_raw", "toast_acquisition", "momi_runtime", "momi_warehouse", "momi_archive",
    "legacy_recipe_staging",
  ],
}

test("defaults every local database operation to dry run", () => {
  const options = parseCli("export", common)
  assert.equal(options.dryRun, true)
  assert.equal(options.environment, "prod")
  assert.equal(options.target, "\\\\nas01\\momi")
  validateRequest(options, workspace)
})

test("requires an explicit mode choice and rejects password arguments", () => {
  assert.throws(() => parseCli("export", [...common, "--password", "secret"]), /unsafe option/)
  assert.throws(() => parseCli("export", [...common, "--execute", "--dry-run"]), /exactly one/)
  assert.throws(() => parseCli("verify", common), /--archive/)
  assert.throws(() => parseCli("verify", [
    ...common, "--archive", "20260714T120000000Z-abcdef123456",
    "--manual-export-dir", "C:\\exports",
  ]), /unsafe option/)
})

test("accepts one optional manual export directory for export", () => {
  const options = parseCli("export", [...common, "--manual-export-dir", "C:\\Toast Exports"])
  assert.equal(options.manualExportDir, "C:\\Toast Exports")
})

test("binds the environment to its configured project", () => {
  const options = parseCli("export", [
    "--env", "dev", "--project-ref", projectRef, "--target", "\\\\nas01\\momi",
  ])
  assert.throws(() => validateRequest(options, workspace), /does not match/)
})

test("builds a compressed schema-only custom dump command", () => {
  const args = buildDumpArgs("X:\\stage\\database.pgdump", workspace.database_schemas)
  assert.deepEqual(args.slice(0, 8), [
    "--format=custom", "--compress=gzip:9", "--strict-names", "--no-owner",
    "--no-privileges", "--lock-wait-timeout=60000", "--file", "X:\\stage\\database.pgdump",
  ])
  assert.deepEqual(args.slice(8), workspace.database_schemas.flatMap((schema) => ["--schema", schema]))
  assert.equal(args.some((value) => /password|postgresql:\/\//i.test(value)), false)
})

test("builds compressed portable source and canonical warehouse SQL", () => {
  const schemas = selectPortableSchemas(workspace.database_schemas)
  assert.deepEqual(schemas, {
    source: [
      "toast_raw", "toast_acquisition", "momi_archive", "legacy_recipe_staging",
    ],
    warehouse: ["momi_warehouse"],
  })
  const args = buildPortableDumpArgs("X:\\stage\\source.sql.gz", schemas.source)
  assert.deepEqual(args.slice(0, 9), [
    "--format=plain", "--compress=gzip:9", "--strict-names", "--no-owner",
    "--no-privileges", "--encoding=UTF8", "--lock-wait-timeout=60000",
    "--file", "X:\\stage\\source.sql.gz",
  ])
  assert.deepEqual(args.slice(9), [
    "--schema", "toast_raw", "--schema", "toast_acquisition", "--schema", "momi_archive",
    "--schema", "legacy_recipe_staging",
  ])
  assert.equal(args.some((value) => /password|postgresql:\/\//i.test(value)), false)
})

test("builds an atomic cleaning restore into an explicit database", () => {
  const args = buildRestoreArgs("X:\\archive\\database.pgdump", "momi_restore_drill_q3")
  assert.deepEqual(args, [
    "--clean", "--if-exists", "--exit-on-error", "--single-transaction",
    "--no-owner", "--no-privileges", "--dbname", "momi_restore_drill_q3",
    "X:\\archive\\database.pgdump",
  ])
})

test("labels quarters in UTC", () => {
  assert.equal(currentQuarter(new Date("2026-07-01T00:00:00.000Z")), "2026-Q3")
})
