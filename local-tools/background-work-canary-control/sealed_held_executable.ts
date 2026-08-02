import { fstatSync } from "node:fs"

export type SealedHeldExecutable = Readonly<Record<never, never>>

type HeldExecutableDetails = Readonly<{
  fd: number
  device: bigint
  inode: bigint
  size: number
}>

const REGISTRY = new WeakMap<object, HeldExecutableDetails>()

export const HELD_EXECUTABLES = Object.freeze({
  seal(details: HeldExecutableDetails): SealedHeldExecutable {
    const sealed = Object.freeze({})
    REGISTRY.set(sealed, Object.freeze({ ...details }))
    return sealed
  },
  inspect(sealed: SealedHeldExecutable): HeldExecutableDetails {
    const details = REGISTRY.get(sealed)
    if (!details) throw new Error("Held executable token is invalid")
    const held = fstatSync(details.fd, { bigint: true })
    if (!held.isFile() || held.dev !== details.device || held.ino !== details.inode ||
      held.size !== BigInt(details.size) || held.nlink !== 0n ||
      (held.mode & 0o777n) !== 0o500n) throw new Error("Held executable was lost")
    return details
  },
})
