import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import test from "node:test"

const roots = [
  fileURLToPath(new URL("../supabase/functions", import.meta.url)),
  fileURLToPath(new URL("../services", import.meta.url)),
]
const migrationRoot = fileURLToPath(
  new URL("../supabase/migrations", import.meta.url),
)

test("enforces warehouse-first API boundaries", async () => {
  const unauthorizedFetches: string[] = []
  const internalHttpCalls: string[] = []
  const ingestNetworkCalls: string[] = []
  const databaseNetworkCalls: string[] = []

  for (const root of roots) {
    let paths: string[]

    try {
      paths = await readdir(root, { recursive: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue
      }
      throw error
    }

    for (const path of paths) {
      if (!path.endsWith(".ts")) {
        continue
      }
      const normalized = path.replaceAll("\\", "/")
      const source = await readFile(join(root, path), "utf8")
      const mayCallHttp = /(hydration|delivery|api-invoker)/.test(normalized)

      if (/\bfetch\s*\(/.test(source) && !mayCallHttp) {
        unauthorizedFetches.push(normalized)
      }
      if (source.includes("/functions/v1/")) {
        internalHttpCalls.push(normalized)
      }
      if (
        normalized.includes("ingest") &&
        (/\bfetch\s*\(/.test(source) || source.includes("EdgeRuntime.waitUntil"))
      ) {
        ingestNetworkCalls.push(normalized)
      }
    }
  }

  const sqlPaths = await readdir(migrationRoot)

  for (const path of sqlPaths) {
    if (!path.endsWith(".sql")) {
      continue
    }
    const source = await readFile(join(migrationRoot, path), "utf8")

    if (/\b(pg_net|net\.http_|http_(get|post|put|delete))\b/i.test(source)) {
      databaseNetworkCalls.push(path)
    }
  }

  assert.deepEqual(unauthorizedFetches, [])
  assert.deepEqual(internalHttpCalls, [])
  assert.deepEqual(ingestNetworkCalls, [])
  assert.deepEqual(databaseNetworkCalls, [])
})
