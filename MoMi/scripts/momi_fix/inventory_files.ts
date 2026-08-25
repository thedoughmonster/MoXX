import { createHash } from "node:crypto"
import { readdir, readFile, readlink } from "node:fs/promises"
import { join, sep } from "node:path"

import { momiFixReceiptPath } from "./registrations.ts"
import type { FileInventory } from "./types.ts"

export async function inventoryFiles(root: string): Promise<FileInventory> {
  const inventory: FileInventory = new Map()
  const pending = [""]
  while (pending.length > 0) {
    const parent = pending.shift() ?? ""
    const entries = await readdir(join(root, parent), { withFileTypes: true })
    for (const entry of entries) {
      const path = join(parent, entry.name).replaceAll(sep, "/")
      if (path === ".git" || path === "node_modules" ||
        path === momiFixReceiptPath) continue
      if (entry.isDirectory()) {
        pending.push(path)
        continue
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) continue
      const absolute = join(root, path)
      const content = entry.isSymbolicLink()
        ? `link:${await readlink(absolute)}`
        : await readFile(absolute)
      const digest = createHash("sha256").update(content).digest("hex")
      inventory.set(path, digest)
    }
  }
  return inventory
}
