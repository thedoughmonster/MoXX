import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { readJson } from "../scripts/architecture/read_json.ts"

test("rejects duplicate JSON members at any object depth", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-json-members-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const path = join(root, "fixture.json")
  for (const source of [
    '{"owned_dataset": {}, "owned_dataset": {}}',
    '{"findings": [{"fingerprint": "one", "fingerprint": "two"}]}',
  ]) {
    await writeFile(path, source)
    await assert.rejects(() => readJson(path), /duplicate JSON member/)
  }
})
