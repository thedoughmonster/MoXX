import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { buildCompactReceipt } from
  "../scripts/dev_loop/build_compact_receipt.ts"
import { renderAgentValidationSummary } from
  "../scripts/dev_loop/render_agent_validation_summary.ts"

test("redacts long credentials before bounded evidence clipping", () => {
  mkdirSync(".momi", { recursive: true })
  const directory = mkdtempSync(".momi/long-credential-")
  const stderrPath = join(directory, "stderr.log")
  const oversizedPath = join(directory, "oversized.log")
  const ansiPath = join(directory, "ansi.log")
  const oscPath = join(directory, "osc.log")
  const pemPath = join(directory, "pem.log")
  const oversizedPemPath = join(directory, "oversized-pem.log")
  const marker = "MELEAKME"
  const raw = `src/secure.ts:9:4 rule/secret: token=${marker.repeat(2300)}`
  writeFileSync(stderrPath, raw)
  writeFileSync(oversizedPath, `token=${marker.repeat(140000)}`)
  const ansiRaw = `${"€".repeat(21844)}tok\u001b[31men=ANSI_FILE_SECRET`
  writeFileSync(ansiPath, ansiRaw)
  const oscRaw = `${"€".repeat(21844)}tok\u001b]0;title\u0007en=OSC_FILE_SECRET`
  writeFileSync(oscPath, oscRaw)
  const pemRaw = `${"x".repeat(65520)} PRIVATE_KEY="` +
    "-----BEGIN PRIVATE KEY-----\nFILE_PEM_SECRET\n-----END PRIVATE KEY-----\""
  writeFileSync(pemPath, pemRaw)
  const oversizedPemRaw = `${"x".repeat(1048600)}-----BEGIN PRIVATE KEY-----` +
    "\nOVERSIZED_FILE_PEM_SECRET\n-----END PRIVATE KEY-----"
  writeFileSync(oversizedPemPath, oversizedPemRaw)
  try {
    const receipt = buildCompactReceipt({ kind: "validation", commands: [
      { id: "long-credential", enforcement: "hard_stop", status: 1,
        duration_ms: 1, stderr_path: stderrPath },
      { id: "oversized-credential", enforcement: "hard_stop", status: 1,
        duration_ms: 1, stderr_path: oversizedPath },
      { id: "ansi-file-credential", enforcement: "hard_stop", status: 1,
        duration_ms: 1, stderr_path: ansiPath },
      { id: "osc-file-credential", enforcement: "hard_stop", status: 1,
        duration_ms: 1, stderr_path: oscPath },
      { id: "pem-file-credential", enforcement: "hard_stop", status: 1,
        duration_ms: 1, stderr_path: pemPath },
      { id: "oversized-pem-file", enforcement: "hard_stop", status: 1,
        duration_ms: 1, stderr_path: oversizedPemPath },
      { id: "ansi-inline-credential", enforcement: "hard_stop", status: 1,
        duration_ms: 1,
        stderr: "src/inline.ts:3:2 rule: tok\u001b[31men=ANSI_INLINE_SECRET" },
      { id: "control-inline-credential", enforcement: "hard_stop", status: 1,
        duration_ms: 1,
        stderr: "tok\u009b31men=C1_SECRET\ntok\u0000en=C0_SECRET" },
      { id: "pem-inline-credential", enforcement: "hard_stop", status: 1,
        duration_ms: 1, stderr: "PRIVATE_KEY=\"-----BEGIN RSA PRIVATE KEY-----" +
          "\nINLINE_PEM_SECRET\n-----END RSA PRIVATE KEY-----\"" },
      { id: "oversized-pem-inline", enforcement: "hard_stop", status: 1,
        duration_ms: 1, stderr: `${"x".repeat(1048600)}` +
          "-----BEGIN PRIVATE KEY-----\nOVERSIZED_INLINE_PEM_SECRET" +
          "\n-----END PRIVATE KEY-----" },
    ] })
    const summary = renderAgentValidationSummary(
      receipt,
      ".momi/long-credential-receipt.json",
    )
    const compact = JSON.stringify(receipt) + summary
    assert.doesNotMatch(compact, /MELEAKME/u)
    assert.doesNotMatch(compact, /ANSI_(?:FILE|INLINE)_SECRET/u)
    assert.doesNotMatch(compact, /(?:OSC_FILE|C[01])_SECRET/u)
    assert.doesNotMatch(compact,
      /(?:(?:OVERSIZED_)?(?:FILE|INLINE))_PEM_SECRET|BEGIN .*PRIVATE KEY/u)
    assert.doesNotMatch(compact, /\u001b/u)
    assert.match(compact, /src\/secure\.ts:9:4/u)
    assert.match(compact, /\[REDACTED\]/u)
    assert.match(compact, /exceeded safe redaction bound/u)
    assert.match(compact, /\[REDACTED PRIVATE KEY\]/u)
    assert.match(readFileSync(stderrPath, "utf8"), /MELEAKME/u)
    assert.match(readFileSync(oversizedPath, "utf8"), /MELEAKME/u)
    assert.match(readFileSync(ansiPath, "utf8"), /ANSI_FILE_SECRET/u)
    assert.match(readFileSync(oscPath, "utf8"), /OSC_FILE_SECRET/u)
    assert.match(readFileSync(pemPath, "utf8"), /FILE_PEM_SECRET/u)
    assert.match(readFileSync(oversizedPemPath, "utf8"), /OVERSIZED_FILE_PEM_SECRET/u)
  } finally {
    rmSync(directory, { recursive: true })
  }
})
