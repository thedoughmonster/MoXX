import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("publishes one public-safe disposition for every frozen class", () => {
  const receipt = read("docs/mox-390-cutover-receipt.md")
  assert.match(receipt, /230 \(217 MoMi, 13 MoXi\)/)
  assert.match(receipt, /15 \(11 MoMi, 4 MoXi\)/)
  assert.match(receipt, /12 \(7 MoMi, 5 MoXi\)/)
  for (const total of ["23", "429", "176"]) assert.match(
    receipt,
    new RegExp(`\\| ${total} \\|`),
  )
  assert.match(receipt, /does not complete the live source[\s\S]*cutover/)
  assert.match(receipt, /recorded dispositions remain to be executed/)
  assert.match(receipt, /source workflows remain enabled pending equivalence proof/)
  assert.match(receipt, /remapping to MoXX remains pending/)
  assert.doesNotMatch(receipt, /Explicitly closed as superseded/)
  assert.doesNotMatch(receipt, /Source workflows disabled/)
  assert.doesNotMatch(receipt, /Mappings changed to MoXX/)
  assert.doesNotMatch(receipt, /CLOUDFLARE_API_TOKEN|SUPABASE_ACCESS_TOKEN/)
})

test("keeps the equivalence workflow non-mutating", () => {
  const workflow = read(".github/workflows/cutover-equivalence.yml")
  assert.match(workflow, /pnpm momi-impact plan/)
  assert.match(workflow, /pnpm run cloudflare:dry-run/)
  assert.doesNotMatch(workflow, /deploy:apply|database-access:renew/)
  assert.doesNotMatch(workflow, /wrangler rollback/)
})

test("pins prepared deployment authority to the exact MoXX repository", () => {
  const contract = read(
    "MoMi/scripts/deploy/assert_github_deployment_authority.ts",
  )
  assert.match(
    contract,
    /thedoughmonster\/MoXX\/\.github\/workflows\/deploy-\$\{environment\}/,
  )
  assert.doesNotMatch(contract, /thedoughmonster\/momi-backend\/\.github/)
})

test("does not touch the scheduled Supabase renewal workflow", () => {
  const workflow = read(".github/workflows/renew-database-access.yml")
  assert.doesNotMatch(workflow, /MOX-390 registration touch/)
})
