import type { InventoryResult } from "./types.ts"

export function assertInventory(result: InventoryResult): void {
  console.log(JSON.stringify(result, null, 2))
  const failures = [...result.missing, ...result.unexpected, ...result.expired]
  if (failures.length > 0) {
    throw new Error(`Hosted inventory mismatch: ${failures.join(", ")}`)
  }
}
