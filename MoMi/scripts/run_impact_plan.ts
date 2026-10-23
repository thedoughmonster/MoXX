import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { buildBoundPlan } from "./dev_loop/build_bound_plan.ts"
import { canonicalJson } from "./dev_loop/canonical_json.ts"
import { redactValue } from "./dev_loop/redact_value.ts"
import { readOption } from "./read_option.ts"

if (process.argv[2] !== "plan") throw new Error("Usage: momi-impact plan")
const base = readOption("base", "origin/dev")
const head = readOption("head", "HEAD")
const output = readOption("output", "")
const committed = process.argv.includes("--committed")
const plan = await buildBoundPlan(base, head, !committed)
const source = `${canonicalJson(redactValue(plan))}\n`
if (output) {
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, source)
} else {
  process.stdout.write(source)
}
