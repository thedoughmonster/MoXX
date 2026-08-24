import type { FileInventory } from "./types.ts"

export function changedInventoryPaths(
  before: FileInventory,
  after: FileInventory,
): string[] {
  const paths = new Set([...before.keys(), ...after.keys()])
  return [...paths].filter((path) => before.get(path) !== after.get(path)).sort()
}
