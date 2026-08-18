import { readFile } from "node:fs/promises"

import { hashText } from "../dev_loop/hash_text.ts"

export async function digestServiceAuthoritySource(path: string): Promise<string> {
  return hashText(await readFile(path, "utf8"))
}
