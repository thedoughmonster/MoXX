import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const receipt = readFileSync("docs/mox-390-cutover-receipt.md", "utf8")
const readme = readFileSync("README.md", "utf8")
const workflowReadme = readFileSync(".github/workflows/README.md", "utf8")

assert.match(readme, /Live cutover[\s\S]*still pending/)
assert.match(receipt, /does not complete the live source[\s\S]*cutover/)
assert.match(receipt, /recorded dispositions remain to be executed/)
assert.match(receipt, /source workflows remain enabled pending equivalence proof/)
assert.match(receipt, /remapping to MoXX remains pending/)
assert.match(receipt, /source tombstone commits will record/)
assert.match(receipt, /Source[\s\S]*commits will be recorded/)
assert.doesNotMatch(receipt, /metadata is retained with the source tombstone commits/)
assert.match(receipt, /\| Remote branches \| 230 \(217 MoMi, 13 MoXi\) \|/)
assert.match(receipt, /\| Open pull requests \| 15 \(11 MoMi, 4 MoXi\) \|/)
assert.match(receipt, /\| Workflows \| 12 \(7 MoMi, 5 MoXi\) \|/)
assert.match(receipt, /\| Local source workspaces \| 23 \|/)
assert.match(receipt, /\| GitHub issues \| 429 \|/)
assert.match(receipt, /\| Deployments \| 176 \|/)
assert.match(receipt, /Each inventory row appears in exactly one class/)
assert.match(receipt, /never rewrites history/)
assert.match(workflowReadme, /not execution authorities/)

process.stdout.write("Validated MOX-390 cutover receipt and authority mapping.\n")
