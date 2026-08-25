import { chmod, lstat, mkdir, realpath } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"

export async function prepareReceiptRootForHome(accountHome: string): Promise<string> {
  if (!isAbsolute(accountHome) || resolve(accountHome) !== accountHome ||
    accountHome.includes("\0")) {
    throw new Error("OS account home is unsafe")
  }
  const [homeInfo, actualHome] = await Promise.all([
    lstat(accountHome), realpath(accountHome),
  ])
  if (!homeInfo.isDirectory() || homeInfo.isSymbolicLink() ||
    actualHome !== accountHome) throw new Error("OS account home is unsafe")
  const segments = [".local", "state", "momi", "background-work-canary"]
  let current = accountHome
  for (const segment of segments) {
    current = join(current, segment)
    let created = false
    try {
      await mkdir(current, { mode: 0o700 })
      created = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw new Error("Canonical receipt root is unavailable")
      }
    }
    const [info, actual] = await Promise.all([lstat(current), realpath(current)])
    if (!info.isDirectory() || info.isSymbolicLink() || actual !== current) {
      throw new Error("Canonical receipt root has an unsafe component")
    }
    if (created) await chmod(current, 0o700)
  }
  return current
}
