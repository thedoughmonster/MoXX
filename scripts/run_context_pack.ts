import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { buildContextPacket } from "./dev_loop/build_context_packet.ts"
import { canonicalJson } from "./dev_loop/canonical_json.ts"
import { redactValue } from "./dev_loop/redact_value.ts"
import { readOption } from "./read_option.ts"

if (process.argv[2] !== "pack") throw new Error("Usage: momi-context pack")
const issue = Number(readOption("issue", "0"))
const title = readOption("title", `GitHub issue #${issue}`)
const base = readOption("base", "origin/dev")
const head = readOption("head", "HEAD")
const output = readOption("output", "")
const packet = await buildContextPacket(issue, title, base, head)
const source = `${canonicalJson(redactValue(packet))}\n`
if (output) {
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, source)
} else {
  process.stdout.write(source)
}
