import { constants } from "node:fs"
import { open } from "node:fs/promises"

export async function appendAndSync(path: string, line: string): Promise<void> {
  const flags = constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW
  const handle = await open(path, flags)
  try {
    await handle.writeFile(line, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
}
