import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { assertLinkedDev } from
  "../local-tools/legacy-recipe-import/assert_linked_dev.ts"
import { buildPgEnvironment } from
  "../local-tools/legacy-recipe-import/build_pg_environment.ts"
import { buildSupabaseLinkArgs } from
  "../local-tools/legacy-recipe-import/build_supabase_link_args.ts"
import { buildSupabaseQueryArgs } from
  "../local-tools/legacy-recipe-import/build_supabase_query_args.ts"
import {
  DEV_PROJECT_REF, DIRECT_PG_HOST, POOLER_PG_HOST,
} from "../local-tools/legacy-recipe-import/constants.ts"
import { runDatabaseFile } from
  "../local-tools/legacy-recipe-import/run_database_file.ts"
import { sha256Text } from
  "../local-tools/legacy-recipe-import/sha256_text.ts"
import type { PlanOutput } from
  "../local-tools/legacy-recipe-import/types.ts"

const basePg = {
  PGPORT: "5432", PGDATABASE: "postgres", PGPASSWORD: "not-logged",
  PGSSLMODE: "verify-full",
}

test("binds psql only to exact dev identities with verified TLS", () => {
  assert.equal(buildPgEnvironment({
    ...basePg, PGHOST: DIRECT_PG_HOST, PGUSER: "postgres",
  }).PGCHANNELBINDING, "require")
  assert.doesNotThrow(() => buildPgEnvironment({
    ...basePg, PGHOST: POOLER_PG_HOST, PGUSER: `postgres.${DEV_PROJECT_REF}`,
  }))
  for (const invalid of [
    { PGHOST: `${DIRECT_PG_HOST}.evil`, PGUSER: "postgres" },
    { PGHOST: DIRECT_PG_HOST, PGUSER: `postgres.${DEV_PROJECT_REF}` },
    { PGHOST: POOLER_PG_HOST, PGUSER: "postgres" },
    { PGHOST: DIRECT_PG_HOST, PGUSER: "postgres", PGSSLMODE: "require" },
    { PGHOST: DIRECT_PG_HOST, PGUSER: "postgres", PGPORT: "6543" },
  ]) assert.throws(() => buildPgEnvironment({ ...basePg, ...invalid }))
})

test("constructs only the approved linked CLI commands", () => {
  assert.deepEqual(buildSupabaseLinkArgs("C:\\repo"), [
    "link", "--project-ref", DEV_PROJECT_REF, "--workdir", "C:\\repo", "--yes",
  ])
  assert.deepEqual(buildSupabaseQueryArgs("C:\\plan\\x.sql", "C:\\repo"), [
    "db", "query", "--linked", "--file", "C:\\plan\\x.sql",
    "--workdir", "C:\\repo", "--output", "json",
  ])
})

test("executes plan files sequentially and stops on the first rejection", async () => {
  const source = await readFile(new URL(
    "../local-tools/legacy-recipe-import/execute_plan.ts", import.meta.url,
  ), "utf8")
  assert.match(source, /for \(const file[\s\S]+await runDatabaseFile/)
  assert.doesNotMatch(source, /Promise\.all/)
})

test("requires exact workspace and linked development references", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-linked-dev-"))
  await mkdir(join(root, "supabase", ".temp"), { recursive: true })
  await writeFile(join(root, "workspace.json"), JSON.stringify({
    environments: { dev: { project_ref: DEV_PROJECT_REF } },
    toolchain: { supabase_cli: "2.109.1" },
  }))
  const linked = join(root, "supabase", ".temp", "project-ref")
  await writeFile(linked, `${DEV_PROJECT_REF}\n`)
  await assert.doesNotReject(assertLinkedDev(root))
  await writeFile(linked, "viodfldzuoypnpqaagag\n")
  await assert.rejects(assertLinkedDev(root), /not linked to the approved/)
})

test("rejects a changed SQL file before invoking the linked CLI", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-plan-check-"))
  await mkdir(join(root, "supabase", ".temp"), { recursive: true })
  await writeFile(join(root, "workspace.json"), JSON.stringify({
    environments: { dev: { project_ref: DEV_PROJECT_REF } },
    toolchain: { supabase_cli: "2.109.1" },
  }))
  await writeFile(join(root, "supabase", ".temp", "project-ref"), DEV_PROJECT_REF)
  const sql = "select 1;\n"
  await writeFile(join(root, "000000_import.sql"), "select 2;\n")
  const file = {
    file: "000000_import.sql", phase: "import" as const,
    bytes: Buffer.byteLength(sql), sha256: sha256Text(sql),
  }
  const output = {
    directory: root,
    plan: {
      schema_version: 1, import_run_id: "x", source_package_id: "x",
      manifest_sha256: "0".repeat(64), generated_at: new Date(0).toISOString(),
      files: [file],
    },
  } as PlanOutput
  await assert.rejects(runDatabaseFile(output, file, {
    kind: "supabase-cli", environment: {}, workspaceRoot: root,
  }), /Sealed file SHA-256 mismatch/)
})
