import assert from "node:assert/strict"
import { mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { digestExecutionAuthority } from "../scripts/architecture/digest_execution_authority.ts"
import type { ExecutionAuthority, ExecutionAuthorityContext } from
  "../scripts/architecture/execution_authority_types.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateExecutionAuthority } from "../scripts/architecture/validate_execution_authority.ts"
const fixtureRoot = join(workspaceRoot, "tests", "fixtures",
  "execution-authority")
const schema = await readJson<object>(join(workspaceRoot,
  "schemas", "execution-authority-v1.schema.json"))
const positive = await readJson<ExecutionAuthority>(
  join(fixtureRoot, "positive.json"))
const context: ExecutionAuthorityContext = {
  root: workspaceRoot,
  repository: "thedoughmonster/momi-backend",
  baseRevision: "99c8a6dd0f5306fe9a450e1d1e0ba256bb1931f8",
  sourceDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  services: {
    "preorder-operations": {
      database: { read: ["momi_orders"], write: ["momi_orders"] },
      provides: [],
      consumes: ["toast-data-acquisition:momi.toast_order_api.v1"],
      network: ["example.com"],
      secrets: ["MOMI_TEST_SECRET"],
      packages: ["@momi/test-contract"],
    },
    "toast-data-acquisition": {
      database: { read: ["toast_raw"], write: ["toast_raw"] },
      provides: ["momi.toast_order_api.v1"],
      consumes: [], network: [], secrets: [], packages: [],
    },
  },
  externalAuthorities: [
    "github.contents:read:thedoughmonster/momi-backend",
  ],
  debtTargets: ["legacy.private_table"],
}
test("accepts exact positive, zero, and contract-only grants", async () => {
  const zero = await readJson<ExecutionAuthority>(
    join(fixtureRoot, "zero-authority.json"))
  const contractOnly = structuredClone(zero)
  contractOnly.grant_id = "ea-mox-201-contract-only"
  contractOnly.contracts.call = structuredClone(positive.contracts.call)
  assert.deepEqual(await validateExecutionAuthority(positive, schema, context), [])
  assert.deepEqual(await validateExecutionAuthority(zero, schema, context), [])
  assert.deepEqual(
    await validateExecutionAuthority(contractOnly, schema, context), [],
  )
})
test("reports allow-deny contradictions deterministically", async () => {
  const contradiction = await readJson<ExecutionAuthority>(
    join(fixtureRoot, "contradiction.json"))
  const first = await validateExecutionAuthority(contradiction, schema, context)
  const second = await validateExecutionAuthority(contradiction, schema, context)
  assert.deepEqual(first, second)
  assert(first.some((item) => item.code === "allow_deny_overlap"))
})
test("canonical digest ignores member order and excluded identity fields", () => {
  const reordered = Object.fromEntries(
    Object.entries(structuredClone(positive)).reverse(),
  ) as unknown as ExecutionAuthority
  reordered.$schema = "another-schema-location"
  reordered.source_digest = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  assert.equal(
    digestExecutionAuthority(reordered),
    digestExecutionAuthority(positive),
  )
  reordered.grant_id = "ea-mox-201-changed"
  assert.notEqual(
    digestExecutionAuthority(reordered),
    digestExecutionAuthority(positive),
  )
})
function setNested(
  target: Record<string, unknown>, path: string, value: unknown,
) {
  const segments = path.split(".")
  let current: unknown = target
  for (const segment of segments.slice(0, -1)) {
    current = Array.isArray(current)
      ? current[Number(segment)]
      : (current as Record<string, unknown>)[segment]
  }
  const leaf = segments.at(-1)!
  if (Array.isArray(current)) current[Number(leaf)] = value
  else (current as Record<string, unknown>)[leaf] = value
}
const rejections = await readJson<Array<{
  name: string
  path: string
  value: unknown
  code: string
}>>(join(fixtureRoot, "rejections.json"))
for (const rejection of rejections) {
  test(`rejects ${rejection.name}`, async () => {
    const grant = structuredClone(positive) as unknown as Record<string, unknown>
    setNested(grant, rejection.path, rejection.value)
    const diagnostics = await validateExecutionAuthority(grant, schema, context)
    assert(diagnostics.some((item) => item.code === rejection.code),
      `${rejection.name}: ${JSON.stringify(diagnostics)}`)
  })
}
test("rejects unknown fields, duplicates, and unsorted collections", async () => {
  const unknown = { ...structuredClone(positive), unexpected: true }
  const duplicate = structuredClone(positive)
  duplicate.secrets.reference.push("MOMI_TEST_SECRET")
  const unsorted = structuredClone(positive)
  unsorted.secrets.reference = ["Z_SECRET", "A_SECRET"]
  assert((await validateExecutionAuthority(unknown, schema, context)).some(
    (item) => item.code === "schema_invalid"))
  assert((await validateExecutionAuthority(duplicate, schema, context)).some(
    (item) => item.code === "schema_invalid"))
  assert((await validateExecutionAuthority(unsorted, schema, context)).some(
    (item) => item.code === "collection_unsorted"))
})
test("rejects a symlink that escapes the revision root", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-authority-root-"))
  const outside = await mkdtemp(join(tmpdir(), "momi-authority-outside-"))
  t.after(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  })
  await symlink(outside, join(root, "escape"))
  const grant = await readJson<ExecutionAuthority>(
    join(fixtureRoot, "zero-authority.json"))
  grant.filesystem.read.push({
    path: "escape",
    kind: "directory",
    recursive: false,
  })
  const diagnostics = await validateExecutionAuthority(
    grant, schema, { ...context, root },
  )
  assert(diagnostics.some((item) => item.code === "symlink_escape"))
})
