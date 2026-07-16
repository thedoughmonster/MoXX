import type { ChecksumLedger } from "./types.ts"

export function requireLedgerHash(ledger: ChecksumLedger, path: string): string {
  const hash = ledger.get(path)
  if (!hash) throw new Error(`Authenticated package ledger omits ${path}`)
  return hash
}
