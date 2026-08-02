import { createHash } from "node:crypto"
import { chmodSync, closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync,
  mkdtempSync, openSync, readSync, realpathSync, rmSync,
  unlinkSync, writeSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import type { HeldNativeSnapshot,
  NativeCliInstallation } from "./native_cli_installation_types.ts"
import { REQUIRED_SUPABASE_NATIVE_SHA256 } from "./repository_preflight_constants.ts"

export function snapshotNativeCli(
  source: NativeCliInstallation,
  temporaryRoot: string,
): HeldNativeSnapshot {
  let directory: string | undefined
  let directoryFd: number | undefined
  let sourceFd: number | undefined
  let heldFd: number | undefined
  try {
    if (!isAbsolute(temporaryRoot) || resolve(temporaryRoot) !== temporaryRoot ||
      realpathSync(temporaryRoot) !== temporaryRoot) throw new Error()
    const root = lstatSync(temporaryRoot)
    if (!root.isDirectory() || root.isSymbolicLink()) throw new Error()
    directory = mkdtempSync(join(temporaryRoot, "momi-canary-native-"))
    chmodSync(directory, 0o700)
    const directoryStat = lstatSync(directory)
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() ||
      (directoryStat.mode & 0o777) !== 0o700 || realpathSync(directory) !== directory) throw new Error()
    directoryFd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY)
    sourceFd = openSync(source.sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW)
    const before = fstatSync(sourceFd, { bigint: true })
    if (!before.isFile() || before.dev !== source.device || before.ino !== source.inode ||
      before.size !== BigInt(source.size)) throw new Error()
    const stagedPath = join(directory, "supabase")
    const writeFd = openSync(stagedPath, constants.O_WRONLY | constants.O_CREAT |
      constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    const sourceHash = createHash("sha256")
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    let offset = 0
    try {
      while (offset < source.size) {
        const count = readSync(sourceFd, buffer, 0, Math.min(buffer.length,
          source.size - offset), offset)
        if (count < 1) throw new Error()
        sourceHash.update(buffer.subarray(0, count))
        let written = 0
        while (written < count) {
          written += writeSync(writeFd, buffer, written, count - written, offset + written)
        }
        offset += count
      }
      fsyncSync(writeFd)
      fchmodSync(writeFd, 0o500)
      fsyncSync(writeFd)
    } finally { closeSync(writeFd) }
    fsyncSync(directoryFd)
    const after = fstatSync(sourceFd, { bigint: true })
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs ||
      sourceHash.digest("hex") !== REQUIRED_SUPABASE_NATIVE_SHA256) throw new Error()
    heldFd = openSync(stagedPath, constants.O_RDONLY | constants.O_NOFOLLOW)
    const held = fstatSync(heldFd, { bigint: true })
    const heldHash = createHash("sha256")
    offset = 0
    while (offset < source.size) {
      const count = readSync(heldFd, buffer, 0, Math.min(buffer.length,
        source.size - offset), offset)
      if (count < 1) throw new Error()
      heldHash.update(buffer.subarray(0, count))
      offset += count
    }
    if (!held.isFile() || held.nlink !== 1n || held.size !== BigInt(source.size) ||
      (held.mode & 0o777n) !== 0o500n || heldHash.digest("hex") !==
      REQUIRED_SUPABASE_NATIVE_SHA256) throw new Error()
    unlinkSync(stagedPath)
    fsyncSync(directoryFd)
    closeSync(directoryFd)
    directoryFd = undefined
    closeSync(sourceFd)
    sourceFd = undefined
    const result = { fd: heldFd, directory, device: held.dev,
      inode: held.ino, size: Number(held.size) }
    heldFd = undefined
    return result
  } catch {
    if (heldFd !== undefined) try { closeSync(heldFd) } catch { /* cleanup */ }
    if (sourceFd !== undefined) try { closeSync(sourceFd) } catch { /* cleanup */ }
    if (directoryFd !== undefined) try { closeSync(directoryFd) } catch { /* cleanup */ }
    if (directory) try { rmSync(directory, { recursive: true, force: true }) } catch { /* cleanup */ }
    throw new Error("Pinned native provider snapshot failed")
  }
}
