import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"

import type { GeneratorResult } from "../codex_hooks/types.ts"
import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { assertBoundedFixPaths } from "./assert_bounded_fix_paths.ts"
import { momiFixes, momiFixReceiptPath } from "./registrations.ts"
import { runRegisteredFix } from "./run_registered_fix.ts"
import type { FixId, FixReceipt } from "./types.ts"

export async function runMomiFix(
  args: string[],
  root: string,
  runGenerator?: (root: string, kind: FixId) => Promise<GeneratorResult>,
): Promise<FixReceipt> {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {},
    strict: true,
  })
  if (positionals.length !== 2 || positionals[0] !== "run") {
    throw new Error("Usage: pnpm momi-fix run <fix-id>")
  }
  const id = positionals[1]
  if (!Object.hasOwn(momiFixes, id)) throw new Error(`Unknown fix ID: ${id}`)
  const fix = momiFixes[id as FixId]
  await assertBoundedFixPaths(root, fix)
  const path = join(root, momiFixReceiptPath)
  await rm(path, { force: true })
  const receipt = await runRegisteredFix(root, fix, runGenerator)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${canonicalJson(receipt)}\n`, "utf8")
  return receipt
}
