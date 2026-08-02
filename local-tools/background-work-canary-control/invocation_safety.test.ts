import assert from "node:assert/strict"
import test from "node:test"

import { assertDevelopmentScope } from "./assert_development_scope.ts"
import { buildChildEnvironment } from "./build_child_environment.ts"
import { parseCli } from "./parse_cli.ts"

test("invocation safety fails closed and strips ambient authority", () => {
  const parsed = parseCli([
    "--",
    "--env",
    "dev",
    "--project-ref",
    "xtbraqnlskmqxinjxxdn",
  ])
  assert.deepEqual(assertDevelopmentScope(parsed), {
    environment: "dev",
    projectRef: "xtbraqnlskmqxinjxxdn",
  })

  assert.throws(parseCli.bind(null, []), /Required option missing/)
  assert.throws(
    parseCli.bind(null, ["--env", "dev"]),
    /Required option missing: --project-ref/,
  )
  assert.throws(
    parseCli.bind(null, ["--project-ref", "xtbraqnlskmqxinjxxdn"]),
    /Required option missing: --env/,
  )
  assert.throws(
    parseCli.bind(null, ["--env", "dev", "--env", "dev"]),
    /Duplicate option/,
  )
  assert.throws(
    parseCli.bind(null, [
      "--project-ref",
      "xtbraqnlskmqxinjxxdn",
      "--project-ref",
      "xtbraqnlskmqxinjxxdn",
    ]),
    /Duplicate option/,
  )
  assert.throws(
    parseCli.bind(null, ["--env", "dev", "--unsafe", "value"]),
    /Unknown or unsafe option/,
  )
  assert.throws(
    parseCli.bind(null, ["dev", "--project-ref", "xtbraqnlskmqxinjxxdn"]),
    /Unknown or unsafe option/,
  )
  assert.throws(
    parseCli.bind(null, ["--env", "--project-ref", "xtbraqnlskmqxinjxxdn"]),
    /Missing value/,
  )
  assert.throws(
    assertDevelopmentScope.bind(null, {
      environment: "prod",
      projectRef: "viodfldzuoypnpqaagag",
    }),
    /--env must be exactly dev/,
  )
  assert.throws(
    assertDevelopmentScope.bind(null, {
      environment: "production",
      projectRef: "xtbraqnlskmqxinjxxdn",
    }),
    /--env must be exactly dev/,
  )
  assert.throws(
    assertDevelopmentScope.bind(null, {
      environment: "dev",
      projectRef: "viodfldzuoypnpqaagag",
    }),
    /approved development project/,
  )

  const child = buildChildEnvironment({
    HOME: "/trusted-home",
    LANG: "C.UTF-8",
    PATH: "/trusted-bin",
    XDG_CONFIG_HOME: "/trusted-config",
    SUPABASE_ACCESS_TOKEN: "redacted-test-value",
    SUPABASE_DB_PASSWORD: "redacted-test-value",
    PGPASSWORD: "redacted-test-value",
    SUPABASE_URL: "https://provider.invalid",
    SUPABASE_CLI_BINARY_OVERRIDE: "/untrusted/supabase",
    DATABASE_URL: "postgresql://database.invalid/db",
    API_SECRET: "redacted-test-value",
    RANDOM_TOKEN: "redacted-test-value",
  })
  assert.deepEqual(child, {
    HOME: "/trusted-home",
    LANG: "C.UTF-8",
    PATH: "/trusted-bin",
    XDG_CONFIG_HOME: "/trusted-config",
    SUPABASE_TELEMETRY_DISABLED: "1",
  })
})
