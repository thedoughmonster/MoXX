import assert from "node:assert/strict"
import { link, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { DEV_PROJECT_REF } from "./constants.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import { validateCanonicalLinkage } from "./validate_canonical_linkage.ts"

const hostname = "aws-0-us-east-1.pooler.supabase.com"
const pooler = `postgresql://postgres.${DEV_PROJECT_REF}@${hostname}:5432/postgres`

async function createLinkageFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "momi-linkage-"))
  const directory = join(root, "supabase/.temp")
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(join(directory, "project-ref"), `${DEV_PROJECT_REF}\n`)
  await writeFile(join(directory, "linked-project.json"), JSON.stringify({ ref: DEV_PROJECT_REF }))
  await writeFile(join(directory, "pooler-url"), pooler)
  return root
}

test("accepts only canonical pooler metadata with IPv4 resolution", async () => {
  const root = await createLinkageFixture()
  try {
    const evidence = await validateCanonicalLinkage(root, async () => ["192.0.2.10"])
    assert.match(evidence.identitySha256, /^[0-9a-f]{64}$/)
    assert.equal(evidence.ipv4Resolved, true)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("rejects missing, wrong-project, malformed, credential, direct, and foreign links", async () => {
  const cases = [
    ["missing", null],
    ["wrong-project", pooler],
    ["malformed", "not-a-url"],
    ["credential", `postgresql://postgres.${DEV_PROJECT_REF}:secret@${hostname}:5432/postgres`],
    ["empty-password", `postgresql://postgres.${DEV_PROJECT_REF}:@${hostname}:5432/postgres`],
    ["direct", `postgresql://postgres.${DEV_PROJECT_REF}@db.${DEV_PROJECT_REF}.supabase.co:5432/postgres`],
    ["foreign", `postgresql://postgres.${DEV_PROJECT_REF}@database.example.com:5432/postgres`],
  ] as const
  for (const [name, value] of cases) {
    const root = await createLinkageFixture()
    try {
      const directory = join(root, "supabase/.temp")
      if (name === "missing") await unlink(join(directory, "pooler-url"))
      else if (name === "wrong-project") {
        await writeFile(join(directory, "project-ref"), "viodfldzuoypnpqaagag")
      } else await writeFile(join(directory, "pooler-url"), value!)
      await assert.rejects(validateCanonicalLinkage(root, async () => ["192.0.2.10"]),
        SetupPreflightError, name)
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})

test("rejects symlinked, hard-linked, and non-IPv4 metadata", async () => {
  for (const kind of ["symlink", "hardlink", "dns"] as const) {
    const root = await createLinkageFixture()
    try {
      const path = join(root, "supabase/.temp/pooler-url")
      if (kind !== "dns") {
        const external = join(root, "external")
        await writeFile(external, pooler)
        await unlink(path)
        if (kind === "symlink") await symlink(external, path)
        else await link(external, path)
      }
      await assert.rejects(validateCanonicalLinkage(
        root, async () => kind === "dns" ? ["2001:db8::1"] : ["192.0.2.10"],
      ), SetupPreflightError, kind)
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})
