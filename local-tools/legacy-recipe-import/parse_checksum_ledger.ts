import { decodeUtf8 } from "./decode_utf8.ts"
import type { ChecksumLedger } from "./types.ts"

export function parseChecksumLedger(bytes: Uint8Array): ChecksumLedger {
  const ledger = new Map<string, string>()
  const identities = new Set<string>()
  const lines = decodeUtf8(bytes, "SHA256SUMS.txt").split(/\r?\n/)
  for (const line of lines) {
    if (line === "") continue
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line)
    if (!match || match[2].includes("\\") || match[2].startsWith("/") ||
      match[2].split("/").some((part) => part === "" || part === "." || part === "..")) {
      throw new Error("SHA256SUMS.txt contains an invalid package entry")
    }
    const identity = match[2].toLowerCase()
    if (identities.has(identity)) {
      throw new Error(`SHA256SUMS.txt contains duplicate entry: ${match[2]}`)
    }
    identities.add(identity)
    ledger.set(match[2], match[1])
  }
  if (ledger.size === 0) throw new Error("SHA256SUMS.txt is empty")
  return ledger
}
