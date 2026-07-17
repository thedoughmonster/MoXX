import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { discoverServices } from "../scripts/architecture/discover_services.ts"

test("rejects a top-level service symlink", {
  skip: process.platform === "win32",
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-service-discovery-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const services = join(root, "services")
  const target = join(root, "linked-service")
  await mkdir(services)
  await mkdir(target)
  await symlink(target, join(services, "linked-service"), "dir")
  await assert.rejects(
    () => discoverServices("services", root),
    /services\/linked-service: service directory must not be a symlink/,
  )
})

test("rejects undeclared non-service entries", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-service-discovery-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  await mkdir(join(root, "services"))
  await writeFile(join(root, "services", "README.md"), "No repository exception.\n")
  await assert.rejects(
    () => discoverServices("services", root),
    /services\/README\.md: services may contain only service directories/,
  )
})
