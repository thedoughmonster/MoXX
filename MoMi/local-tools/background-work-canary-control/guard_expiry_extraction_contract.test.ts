import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"
import { DEADMAN_EXPIRY_PLACEHOLDER } from "./deadman_command_constants.ts"
import { VALID_DEADMAN_INPUT } from "./deadman_command.test_fixture.ts"
import { generateCombinedHeartbeatSql } from "./generate_combined_heartbeat_sql.ts"
import { generateDeadmanCommand } from "./generate_deadman_command.ts"
import { generateGuardHeartbeatSql } from "./generate_guard_heartbeat_sql.ts"
import { VALID_GUARD_HEARTBEAT_INPUT } from "./guard_heartbeat.test_fixture.ts"

test("every guard expiry readback anchors past earlier timestamptz literals", async () => {
  const expiry = "2026-08-02T14:26:50.123456Z"
  const currentTemplate = generateDeadmanCommand(VALID_DEADMAN_INPUT)
  const currentCommand = currentTemplate.replace(DEADMAN_EXPIRY_PLACEHOLDER, expiry)
  const prefixedCommand = `select timestamptz '2024-06-21T00:00:00.000000Z';\n${currentCommand}`
  assert.equal(prefixedCommand.match(/timestamptz '([^']+)'/)?.[1],
    "2024-06-21T00:00:00.000000Z")
  assert.equal(prefixedCommand.match(
    /expiry_at constant timestamptz := timestamptz '([^']+)'/,
  )?.[1], expiry)
  const heartbeat = generateGuardHeartbeatSql(VALID_GUARD_HEARTBEAT_INPUT)
    .replace(currentTemplate, "CURRENT")
    .replace(VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand, "NEXT")
  const combined = generateCombinedHeartbeatSql({
    ...VALID_GUARD_HEARTBEAT_INPUT, includeResource: true,
  }).replace(currentTemplate, "CURRENT")
    .replace(VALID_GUARD_HEARTBEAT_INPUT.nextDeadmanCommand, "NEXT")
  const anchored = /from 'expiry_at constant timestamptz := timestamptz/g
  assert.equal((heartbeat.match(anchored) ?? []).length, 2)
  assert.equal((combined.match(anchored) ?? []).length, 3)
  const files = (await readdir(import.meta.dirname)).filter((name) =>
    name.endsWith(".ts") && !name.endsWith(".test.ts") &&
    !name.endsWith(".test_fixture.ts"))
  for (const name of files) {
    assert.doesNotMatch(await readFile(join(import.meta.dirname, name), "utf8"),
      /from 'timestamptz ''\(\[\^''\]\+\)'''/)
  }
})
