import assert from "node:assert/strict"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import { assertRepositoryPreflight } from "./assert_repository_preflight.ts"
import { buildSupabaseQueryCommand } from "./build_supabase_query_command.ts"
import { parseFastQueryOutput } from "./parse_fast_query_output.ts"
import { parseResourceQueryOutput } from "./parse_resource_query_output.ts"
import {
  VALID_FAST_QUERY_SAMPLE,
  VALID_RESOURCE_BASELINE,
  VALID_RESOURCE_QUERY_SAMPLE,
  VALID_START_CRON_RUN_ID,
} from "./query_sample_fixtures.test_fixture.ts"
import { createRepositoryFixture } from "./repository_fixture.test_fixture.ts"
import { VALID_FAST_SAMPLE } from "./sample_fixtures.test_fixture.ts"
import {
  FAST_SQL_FILENAME,
  FAST_SQL_MARKER,
  RESOURCE_SQL_FILENAME,
  RESOURCE_SQL_MARKER,
  SQL_ARTIFACT_DIRECTORY,
} from "./sql_artifact_constants.ts"
import { verifySqlArtifact } from "./verify_sql_artifact.ts"

const temporaryRoot = mkdtempSync(join(tmpdir(), "momi-canary-query-contract-"))
const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
const sha = "9e9425ac63cdfaf2fad0fb8a12b975642221aac9"
const evidence = {
  nodeVersion: "24.14.0", pnpmVersion: "11.7.0", branch: "dev",
  headSha: sha, expectedHeadSha: sha, porcelainStatus: "",
  projectRef: "xtbraqnlskmqxinjxxdn",
}
const queryBytes = (marker: string, sample: unknown) => Buffer.from(
  `${JSON.stringify([{ marker, schema_version: 1, sample }], null, 2)}\n`, "utf8",
)

after(() => rmSync(temporaryRoot, { recursive: true, force: true }))

test("accepts only the exact released development repository evidence", () => {
  const fixture = join(temporaryRoot, "repository")
  createRepositoryFixture(fixture)
  assert.deepEqual(assertRepositoryPreflight(fixture, evidence), {
    nodeVersion: "24.14.0", pnpmVersion: "11.7.0", supabaseCliVersion: "2.109.1",
    branch: "dev", headSha: sha, projectRef: "xtbraqnlskmqxinjxxdn",
  })
  assert.throws(() => assertRepositoryPreflight(fixture, { ...evidence, branch: "prod" }))
  assert.throws(() => assertRepositoryPreflight(fixture, {
    ...evidence, porcelainStatus: "?? unexpected",
  }))
  writeFileSync(join(fixture, "supabase/.temp/project-ref"), "viodfldzuoypnpqaagag\n")
  assert.throws(() => assertRepositoryPreflight(fixture, evidence))
  writeFileSync(join(fixture, "supabase/.temp/project-ref"), "xtbraqnlskmqxinjxxdn\n")
  writeFileSync(join(fixture, "node_modules/supabase/package.json"), "{malformed")
  assert.throws(() => assertRepositoryPreflight(fixture, evidence))
  rmSync(join(fixture, "node_modules/supabase/package.json"))
  assert.throws(() => assertRepositoryPreflight(fixture, evidence))
})

test("builds the constant pinned Supabase query argv", () => {
  const file = join(sourceRoot, SQL_ARTIFACT_DIRECTORY, FAST_SQL_FILENAME)
  assert.deepEqual(buildSupabaseQueryCommand(sourceRoot, file), {
    executableName: "pnpm",
    arguments: [
      "exec", "supabase", "db", "query", "--linked", "--file", file,
      "--workdir", sourceRoot, "--output-format", "json",
    ],
  })
  assert.throws(() => buildSupabaseQueryCommand(sourceRoot, join(sourceRoot, "other.sql")))
})

test("verifies both sealed SQL artifacts and rejects changed bytes", () => {
  assert.equal(verifySqlArtifact(sourceRoot, "fast").kind, "fast")
  assert.equal(verifySqlArtifact(sourceRoot, "resource").kind, "resource")
  const copiedRoot = join(temporaryRoot, "changed-sql")
  cpSync(join(sourceRoot, SQL_ARTIFACT_DIRECTORY),
    join(copiedRoot, SQL_ARTIFACT_DIRECTORY), { recursive: true })
  const changed = join(copiedRoot, SQL_ARTIFACT_DIRECTORY, FAST_SQL_FILENAME)
  writeFileSync(changed, `${readFileSync(changed, "utf8")} `)
  assert.throws(() => verifySqlArtifact(copiedRoot, "fast"))
})

test("parses an exact fast row into the accepted Phase E schema", () => {
  const parsed = parseFastQueryOutput(queryBytes(FAST_SQL_MARKER, VALID_FAST_QUERY_SAMPLE), {
    expectedGuardPresent: true, startCronRunId: VALID_START_CRON_RUN_ID,
    missedSamples: 0, overlappingSamples: 0,
  })
  assert.deepEqual(parsed, VALID_FAST_SAMPLE)
})

test("parses resource absolutes into Phase E validated deltas", () => {
  assert.deepEqual(parseResourceQueryOutput(
    queryBytes(RESOURCE_SQL_MARKER, VALID_RESOURCE_QUERY_SAMPLE),
    VALID_RESOURCE_BASELINE,
  ), {
    observedAtUtcMs: VALID_FAST_SAMPLE.observedAtUtcMs,
    activeCronExecutions: 1, targetRunCount: 0, targetRunFailures: 0,
    guardRunCount: 12, guardRunFailures: 0, guardCronHistoryEstimatedBytes: 49_152,
    totalTaskGrowthBytes: 2_000, databaseGrowthBytes: 2_000,
    cronHistoryGrowthBytes: 1_000, walDirectoryBytes: 855_638_386,
    waitingLocks: 0, deadlockDelta: 0, databaseBackends: 13,
  })
  assert.throws(() => parseResourceQueryOutput(
    queryBytes(RESOURCE_SQL_MARKER, VALID_RESOURCE_QUERY_SAMPLE), {
    ...VALID_RESOURCE_BASELINE, databaseBytes: 9_000_000,
  }))
})
