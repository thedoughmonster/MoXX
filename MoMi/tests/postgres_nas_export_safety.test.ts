import assert from "node:assert/strict"
import test from "node:test"

import { buildPgEnvironment } from
  "../local-tools/postgres-nas-export/build_pg_environment.ts"
import { validateUncTarget } from
  "../local-tools/postgres-nas-export/validate_unc_target.ts"

test("accepts only normalized remote UNC targets", () => {
  const repository = "C:\\work\\momi-backend"
  assert.doesNotThrow(() => validateUncTarget("\\\\nas01\\backups\\momi", repository))
  assert.throws(() => validateUncTarget(repository, repository), /absolute UNC/)
  assert.throws(() => validateUncTarget("\\\\nas01\\backups\\..\\repo", repository), /traversal/)
  assert.throws(() => validateUncTarget("\\\\?\\UNC\\nas01\\backups", repository), /device/)
  assert.throws(() => validateUncTarget("\\\\localhost\\backups\\momi", repository), /remote NAS/)
  assert.throws(() => validateUncTarget("\\\\nas01\\backups\\CON.txt", repository), /unsafe/)
})

test("passes database passwords only in a restricted PG environment", () => {
  const keys = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "DATABASE_URL"]
  const previous = new Map(keys.map((key) => [key, process.env[key]]))
  Object.assign(process.env, {
    PGHOST: "db.example.invalid",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres",
    PGPASSWORD: "never-written",
    DATABASE_URL: "postgresql://user:secret@example.invalid/postgres",
  })
  try {
    const environment = buildPgEnvironment("export")
    assert.equal(environment.PGPASSWORD, "never-written")
    assert.equal(environment.DATABASE_URL, undefined)
    assert.equal(environment.PGPASSFILE, undefined)
    assert.equal(environment.PGCONNECT_TIMEOUT, "15")
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("allows restore drills only on an exact loopback isolated database", () => {
  const keys = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"]
  const previous = new Map(keys.map((key) => [key, process.env[key]]))
  Object.assign(process.env, {
    PGHOST: "db.example.invalid",
    PGPORT: "5432",
    PGDATABASE: "momi_restore_drill_q3",
    PGUSER: "postgres",
    PGPASSWORD: "never-written",
  })
  try {
    assert.throws(() => buildPgEnvironment("restore", "momi_restore_drill_q3"), /loopback/)
    process.env.PGHOST = "127.0.0.1"
    assert.equal(
      buildPgEnvironment("restore", "momi_restore_drill_q3").PGDATABASE,
      "momi_restore_drill_q3",
    )
    assert.throws(() => buildPgEnvironment("restore", "momi_restore_drill_other"), /exactly/)
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
