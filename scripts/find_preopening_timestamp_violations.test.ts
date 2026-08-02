import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { findPreopeningTimestampViolations } from "./find_preopening_timestamp_violations.ts"

const typescriptAdversary = "Y29uc3QgcHJlZml4ID0gIjIwMjQiCmNvbnN0IHN1ZmZpeCA9ICItMDYtMjBUMjM6MzA6MDAuMDAwWiIKY29uc3Qgam9pbmVkID0gW3ByZWZpeCwgc3VmZml4XS5qb2luKCIiKQpjb25zdCB0ZW1wbGF0ZWQgPSBgJHtwcmVmaXh9LTA2LTIwVDIzOjU5OjU5Ljk5OVpgCmNvbnN0IHBhcnNlZCA9IERhdGUucGFyc2UocHJlZml4ICsgIi0wNi0yMFQwMDowMDowMC4wMDBaIikKY29uc3QgbmVnYXRpdmUgPSBuZXcgRGF0ZSgtMSkKY29uc3Qgb3ZlcmZsb3cgPSBuZXcgRGF0ZSg5OTk5OTk5OTk5OTk5OTk5KQpjb25zdCB1dGMgPSBEYXRlLlVUQygyMDI0LCA1LCAyMCwgMjMsIDU5KQpjb25zdCBuZWdhdGl2ZVV0YyA9IERhdGUuVVRDKC0xLCAwLCAxKQpjb25zdCBvdmVyZmxvd1V0YyA9IERhdGUuVVRDKDk5OTk5OSwgMCwgMSkKY29uc3Qgb2Zmc2V0QmVmb3JlID0gIjIwMjQtMDYtMjFUMDE6MDA6MDArMDI6MDAiCmNvbnN0IG9mZnNldEFmdGVyID0gIjIwMjQtMDYtMjBUMjM6MDA6MDAtMDI6MDAiCmNvbnN0IGZpcnN0X2J1c2luZXNzX2RhdGUgPSAiMjAyNC0wNi0yMCIK"
const sqlAdversary = "LS0gc2VsZWN0IGRhdGUgJ2Vwb2NoJzsKLyogc2VsZWN0IHRvX3RpbWVzdGFtcCgtMSk7ICovCnNlbGVjdCBkYXRlICdlcG9jaCc7CnNlbGVjdCB0aW1lc3RhbXB0eiAnMjAyNC0wNi0yMSAwMTowMDowMCswMjowMCc7CnNlbGVjdCB0aW1lc3RhbXAgJzIwMjQtMDYtMjAgMjM6MDA6MDAnOwpzZWxlY3QgdG9fdGltZXN0YW1wKC0xKTsKc2VsZWN0IHRvX3RpbWVzdGFtcCgxZTk5OSk7CnNlbGVjdCBjYXN0KCdlcG9jaCcgYXMgZGF0ZSk7CnNlbGVjdCAnZXBvY2gnOjp0aW1lc3RhbXB0ejsK"
const commentsOnly = "Ly8gY29uc3Qgb2xkID0gIjIwMjAtMDEtMDFUMDA6MDA6MDAuMDAwWiIKLyogbmV3IERhdGUoLTEpOyAqLwpjb25zdCBib3VuZGFyeSA9ICIyMDI0LTA2LTIxVDAwOjAwOjAwLjAwMFoiCg=="
const docsSql = "c2VsZWN0IGRhdGUgJ2Vwb2NoJzsK"
const aliasAdversary = "Y29uc3QgRCA9IERhdGUKbmV3IEQoMCkKY29uc3QgVSA9IERhdGUuVVRDClUoMTk3MCwgMCwgMSkKY29uc3QgeyBwYXJzZTogUCwgVVRDOiBaIH0gPSBEYXRlClAoIjE5NzAtMDEtMDFUMDA6MDA6MDAuMDAwWiIpClooMTk3MCwgMCwgMSkKY29uc3QgUEQgPSAoZ2xvYmFsVGhpcy5EYXRlKS5wYXJzZQpQRCgiMTk3MC0wMS0wMVQwMDowMDowMC4wMDBaIikKY29uc3QgR0QgPSBnbG9iYWxUaGlzWyJEYXRlIl0KbmV3IEdEKC0xKQpmdW5jdGlvbiBzaGFkb3coRGF0ZTogbmV3ICh2YWx1ZTogbnVtYmVyKSA9PiBvYmplY3QpIHsKICBuZXcgRGF0ZSgwKQp9CnsKICBjb25zdCBEYXRlID0gY2xhc3Mge30KICBuZXcgRGF0ZSgwKQp9CmxldCBmaXJzdEJ1c2luZXNzRGF0ZSA9ICIyMDI0LTA2LTIxIgpmaXJzdEJ1c2luZXNzRGF0ZSA9ICIyMDI0LTA2LTIwIgpjb25zdCByZWNvcmQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fQpyZWNvcmQub3BlbmVkQXQgPSAiMjAyNC0wNi0yMCIKcmVjb3JkWyJjbG9zZWRfYXQiXSA9ICIyMDI0LTA2LTIwIgo="
const dollarAdversary = "c2VsZWN0ICQkZGF0ZSAnZXBvY2gnOyB0b190aW1lc3RhbXAoLTEpOyQkOwpkbyAkYm9keSQKYmVnaW4KICBwZXJmb3JtIHRvX3RpbWVzdGFtcCgtMSk7CiAgcGVyZm9ybSBkYXRlICdlcG9jaCc7CmVuZAokYm9keSQ7CmNyZWF0ZSBmdW5jdGlvbiBwcml2YXRlLmNoZWNrX3RpbWUoKSByZXR1cm5zIHZvaWQgbGFuZ3VhZ2UgcGxwZ3NxbCBhcyAkZm4kCmJlZ2luCiAgcGVyZm9ybSBkYXRlCiAgICAnZXBvJwogICAgJ2NoJzsKZW5kCiRmbiQ7CnNlbGVjdCB0aW1lc3RhbXAgd2l0aCB0aW1lIHpvbmUgJzIwMjQtMDYtMjEgMDE6MDA6MDArMDI6MDAnOwpzZWxlY3QgdGltZXN0YW1wIHdpdGhvdXQgdGltZSB6b25lICcyMDI0LTA2LTIwIDIzOjAwOjAwJzsKc2VsZWN0IGRhdGUgJ2VwbycKICAnY2gnOwo="
const assertionAdversary = "Y29uc3QgRCA9IERhdGUgYXMgRGF0ZUNvbnN0cnVjdG9yCm5ldyBEKDApCmNvbnN0IFAgPSBEYXRlLnBhcnNlIQpjb25zdCBwcmVmaXggPSAiMjAyNCIKUChwcmVmaXggKyAiLTA2LTIwVDIzOjU5OjU5Ljk5OVoiKQpjb25zdCBBID0gPERhdGVDb25zdHJ1Y3Rvcj5EYXRlCm5ldyBBKC0xKQpjb25zdCBTID0gRGF0ZSBzYXRpc2ZpZXMgRGF0ZUNvbnN0cnVjdG9yCm5ldyBTKDApCg=="
const shadowAdversary = "aW1wb3J0IHsgRGF0ZSB9IGZyb20gIi4vY3VzdG9tIgpuZXcgRGF0ZSgwKQp7CiAgY2xhc3MgRGF0ZSB7IGNvbnN0cnVjdG9yKHZhbHVlOiBudW1iZXIpIHt9IH0KICBuZXcgRGF0ZSgwKQp9CnsKICBmdW5jdGlvbiBEYXRlKHZhbHVlOiBudW1iZXIpIHsgcmV0dXJuIHZhbHVlIH0KICBuZXcgRGF0ZSgwKQp9Cg=="
const escapeSqlAdversary = "c2VsZWN0IHRpbWVzdGFtcCAnMjAyNC0wNi0yMCc7CnNlbGVjdCB0aW1lc3RhbXB0eiAnMjAyNC0wNi0yMCc7CnNlbGVjdCBkYXRlIEUnZXBvXHg2M2gnOwpzZWxlY3QgY2FzdChVJidlcG9cMDA2M2gnIGFzIHRpbWVzdGFtcCk7CnNlbGVjdCB0aW1lc3RhbXAgd2l0aCB0aW1lIHpvbmUgRScyMDI0LTA2LTIwJzsKc2VsZWN0IEUnMjAyNC0wNi0yMCc6OnRpbWVzdGFtcHR6Owo="

test("TypeScript AST scan closes constants, joins, templates, offsets, and Date bypasses", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-preopening-ts-"))
  try {
    await writeFile(join(root, "runtime.TS"), Buffer.from(typescriptAdversary, "base64"))
    const findings = await findPreopeningTimestampViolations(root)
    assert.ok(findings.some((finding) => finding.includes("runtime.TS:3: ISO timestamp")))
    assert.ok(findings.some((finding) => finding.includes("runtime.TS:4: ISO timestamp")))
    assert.ok(findings.some((finding) => finding.includes("Date.parse")))
    assert.equal(findings.filter((finding) => finding.includes(": Date predates")).length, 2)
    assert.equal(findings.filter((finding) => finding.includes("Date.UTC")).length, 3)
    assert.ok(findings.some((finding) => finding.includes("01:00:00+02:00")))
    assert.equal(findings.some((finding) => finding.includes("23:00:00-02:00")), false)
    assert.ok(findings.some((finding) => finding.includes("named date 2024-06-20")))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("SQL lexer closes comments, offsets, epoch, casts, and signed Unix bypasses", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-preopening-sql-"))
  try {
    await writeFile(join(root, "migration.SQL"), Buffer.from(sqlAdversary, "base64"))
    const findings = await findPreopeningTimestampViolations(root)
    assert.equal(findings.length, 7)
    assert.ok(findings.some((finding) => finding.includes("SQL date epoch")))
    assert.equal(findings.filter((finding) => finding.includes("SQL Unix timestamp")).length, 2)
    assert.ok(findings.some((finding) => finding.includes("timestamptz 2024-06-21 01:00")))
    assert.equal(findings.some((finding) => finding.includes(":1:") || finding.includes(":2:")), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("TypeScript aliases shadow safely and semantic assignments remain governed", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-preopening-alias-"))
  try {
    await writeFile(join(root, "aliases.ts"), Buffer.from(aliasAdversary, "base64"))
    const findings = await findPreopeningTimestampViolations(root)
    assert.equal(findings.filter((finding) => finding.includes(": Date predates")).length, 2)
    assert.equal(findings.filter((finding) => finding.includes("Date.UTC")).length, 2)
    assert.equal(findings.filter((finding) => finding.includes("Date.parse")).length, 2)
    assert.equal(findings.filter((finding) => finding.includes("named date")).length, 3)
    assert.equal(findings.some((finding) => /aliases\.ts:(13|17):/.test(finding)), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("SQL executable dollar bodies, standard types, and adjacent strings are scanned", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-preopening-dollar-"))
  try {
    await writeFile(join(root, "body.sql"), Buffer.from(dollarAdversary, "base64"))
    const findings = await findPreopeningTimestampViolations(root)
    assert.equal(findings.length, 6)
    assert.equal(findings.filter((finding) => finding.includes("SQL date epoch")).length, 3)
    assert.ok(findings.some((finding) => finding.includes("SQL Unix timestamp")))
    assert.ok(findings.some((finding) => finding.includes("SQL timestamptz")))
    assert.ok(findings.some((finding) => finding.includes("SQL timestamp")))
    assert.equal(findings.some((finding) => finding.includes("body.sql:1:")), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("walker excludes docs consistently, ignores comments, and rejects source symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-preopening-path-"))
  try {
    await mkdir(join(root, "src", "DoCs"), { recursive: true })
    await writeFile(join(root, "src", "DoCs", "history.SQL"), Buffer.from(docsSql, "base64"))
    await writeFile(join(root, "runtime.ts"), Buffer.from(commentsOnly, "base64"))
    await symlink(join(root, "runtime.ts"), join(root, "linked.TS"))
    assert.deepEqual(await findPreopeningTimestampViolations(root), [
      "linked.TS: executable source symlink is prohibited",
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("assertion aliases, declaration shadows, and PostgreSQL escape strings are governed", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-preopening-final-bypasses-"))
  try {
    await writeFile(join(root, "assertions.ts"), Buffer.from(assertionAdversary, "base64"))
    await writeFile(join(root, "shadow.ts"), Buffer.from(shadowAdversary, "base64"))
    await writeFile(join(root, "escapes.sql"), Buffer.from(escapeSqlAdversary, "base64"))
    const findings = await findPreopeningTimestampViolations(root)
    assert.equal(findings.filter((finding) => finding.includes(": Date predates")).length, 3)
    assert.equal(findings.filter((finding) => finding.includes("Date.parse")).length, 1)
    assert.equal(findings.filter((finding) => finding.startsWith("shadow.ts:")).length, 0)
    assert.equal(findings.filter((finding) => finding.startsWith("escapes.sql:")).length, 6)
    assert.equal(findings.filter((finding) => finding.includes("SQL timestamp 2024-06-20")).length, 1)
    assert.equal(findings.filter((finding) => finding.includes("SQL timestamptz 2024-06-20")).length, 3)
    assert.ok(findings.some((finding) => finding.includes("SQL timestamp epoch")))
    assert.ok(findings.some((finding) => finding.includes("SQL date epoch")))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
