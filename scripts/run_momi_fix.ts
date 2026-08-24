import { workspaceRoot } from "./architecture/paths.ts"
import { canonicalJson } from "./dev_loop/canonical_json.ts"
import { runMomiFix } from "./momi_fix/run_momi_fix.ts"

try {
  const receipt = await runMomiFix(process.argv.slice(2), workspaceRoot)
  process.stdout.write(`${canonicalJson(receipt)}\n`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
