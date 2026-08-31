import { chmodSync, lstatSync, readdirSync } from "node:fs"
import { join, resolve, sep } from "node:path"

export function setFinalValidationCheckoutWritable(
  checkoutRoot: string,
  writableRoots: string[],
  writable: boolean,
): void {
  const allowed = writableRoots.map((path) => resolve(path))
  const pending = [resolve(checkoutRoot)]
  while (pending.length > 0) {
    const path = pending.pop()!
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) continue
    const allowedPath = allowed.some((root) =>
      path === root || path.startsWith(`${root}${sep}`)
    )
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) pending.push(join(path, entry))
      chmodSync(path, writable || allowedPath ? 0o755 : 0o555)
      continue
    }
    const executable = (stat.mode & 0o111) !== 0
    chmodSync(path, writable || allowedPath
      ? executable ? 0o755 : 0o644
      : executable ? 0o555 : 0o444)
  }
}
