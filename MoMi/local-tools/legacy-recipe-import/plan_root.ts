import { tmpdir } from "node:os"
import { join } from "node:path"

export function planRoot(): string {
  return join(tmpdir(), "MoMi", "checkpoints", "legacy-recipe-import")
}
