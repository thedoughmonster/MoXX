import { readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"

export function assertLinkedProjectRef(
  projectRef: string,
  linkedRef = readFileSync(
    join(workspaceRoot, "supabase", ".temp", "project-ref"),
    "utf8",
  ).trim(),
): void {
  if (linkedRef !== projectRef) {
    throw new Error(`Supabase CLI linked unexpected project ${linkedRef || "(empty)"}`)
  }
}
