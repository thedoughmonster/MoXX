import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
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
  assert.match(receipt, /sole active product repository at `2026-08-30T14:04:01Z`/)
  assert.match(receipt, /explicitly dispositioned with retained provenance/)
  assert.match(receipt, /obsolete source execution paths are disabled/)
  assert.match(receipt, /active execution routes to MoXX/)
  assert.match(receipt, /Proof-only rollback drill/)
  assert.match(receipt, /33315868802/)
  for (const commit of [
    "8c54fb0c651718b4b563142a67642df3493c53cf",
    "bc7b469c64270ccc878ce8ae22d5152b599b1c07",
    "d4c8ef79c5da6bd85bbc3d591a7999394267a110",
    "ffad94ff15436cfd452f048a87ea09cc49aa0419",
    "f3e45b3ddedcd3c5ff7ee2f2de14a2d69aed2795",
    "89486f572b1c142db42903bbdf71cb19924bda08",
    "3ffaff1a0c7fd1e4cb50db34ba13246820047e46",
  ]) assert.match(receipt, new RegExp(commit))
  assert.doesNotMatch(
    receipt,
    /still pending|remain to be executed|remain authoritative/,
  )
  assert.doesNotMatch(receipt, /metadata is retained with the source tombstone commits/)
  assert.doesNotMatch(receipt, /CLOUDFLARE_API_TOKEN|SUPABASE_ACCESS_TOKEN/)
})

test("records a reconstructible proof-only rollback without live mutation", () => {
  const receipt = read("docs/mox-390-cutover-receipt.md")
  for (const digest of [
    "0dfdda749b5a1bfae908d31985868b78fa82ed053f657764e0e1b4f30500995d",
    "a34cbb91ece0b37b00c5f7969e20d5359dfc47f307c55b0e58406f69f4675223",
    "8899ff6e4cbfcae9df9d581c35193de88a3733dc751c521daf4bf00bc78cbd60",
    "9791a7676fe956fb49af6c6ba7bf87ac1f04a377795366563f1013d6c604379d",
    "9bf8abf5ed4ff7ee101595c6ec2e959c33d15b0bf59f06df5638868e9be4038e",
    "3e996c72b16e99b08fb08bd7b41adf9b25f23e91167877d79aff0c8b2d571e9f",
    "0d569b622ab54160ab8cbff01803fee6d48bbf4f7f88d921110e91db28ee6974",
  ]) assert.match(receipt, new RegExp(digest))
  assert.match(receipt, /separately authorized rollback window/)
  assert.match(receipt, /No history\s+rewrite or data restoration is\s+required/)
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

test("keeps MoXX free of a scheduled Supabase renewal workflow", () => {
  assert.equal(existsSync(".github/workflows/renew-database-access.yml"), false)
  assert.equal(
    existsSync("MoMi/.github/workflows/renew-database-access.yml"),
    false,
  )
})

test("keeps active workspace instructions and architecture identity on MoXX", () => {
  const agents = read("MoXi/AGENTS.md")
  assert.match(agents, /workspace in `thedoughmonster\/MoXX`/)
  assert.match(agents, /Linear is the sole active work-item authority/)
  assert.doesNotMatch(agents, /This private repository owns|momi-backend#\d+/)

  const schema = read("MoMi/schemas/architecture-snapshot-identity-v2.schema.json")
  assert.match(schema, /"repository": \{ "const": "thedoughmonster\/MoXX" \}/)
  assert.match(schema, /"product_path": \{ "const": "MoMi" \}/)
  for (const path of [
    "MoMi/scripts/architecture/build_architecture_snapshot_identity.ts",
    "MoMi/scripts/architecture/inspect_architecture_snapshot_source.ts",
    "MoMi/scripts/architecture/load_service_authority_binding_context.ts",
    "MoMi/scripts/architecture/load_database_object_authority_revision.ts",
  ]) assert.doesNotMatch(read(path), /thedoughmonster\/momi-backend/)
})
