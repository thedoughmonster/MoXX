import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import test from "node:test"

const services = fileURLToPath(new URL("../services", import.meta.url))

test("database adapters retire idle Edge connections", async () => {
  const paths = await readdir(services, { recursive: true })
  const adapters = paths.filter((path) => path.endsWith("database.ts"))
  const unsafe: string[] = []

  for (const path of adapters) {
    const source = await readFile(join(services, path), "utf8")
    if (!source.includes("postgres(connectionString")) continue
    const bounded = /idle_timeout:\s*2/.test(source) &&
      /max:\s*1/.test(source) &&
      /max_lifetime:\s*60/.test(source) &&
      /prepare:\s*false/.test(source)
    if (!bounded) unsafe.push(path.replaceAll("\\", "/"))
  }

  assert.ok(adapters.length >= 12, "expected every database adapter")
  assert.deepEqual(unsafe, [])
})
