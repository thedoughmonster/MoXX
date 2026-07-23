import { readFile, writeFile } from "node:fs/promises"

import { buildCompactReceipt } from "./dev_loop/build_compact_receipt.ts"
import { canonicalJson } from "./dev_loop/canonical_json.ts"
import type { ReceiptInput } from "./dev_loop/types.ts"
import { readOption } from "./read_option.ts"

if (process.argv[2] !== "summarize") throw new Error("Usage: momi-receipt summarize")
const inputPath = readOption("input", "")
if (!inputPath) throw new Error("--input is required")
const outputPath = readOption("output", "")
const input = JSON.parse(await readFile(inputPath, "utf8")) as ReceiptInput
const source = `${canonicalJson(buildCompactReceipt(input))}\n`
if (outputPath) await writeFile(outputPath, source)
else process.stdout.write(source)
