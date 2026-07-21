import { readFileSync } from "node:fs"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"

export function assertLinkedSupabaseTarget(
  projectRef: string,
  linkedRef = readFileSync(
    join(workspaceRoot, "supabase", ".temp", "project-ref"),
    "utf8",
  ).trim(),
  poolerUrl = readFileSync(
    join(workspaceRoot, "supabase", ".temp", "pooler-url"),
    "utf8",
  ).trim(),
): void {
  if (linkedRef !== projectRef) {
    throw new Error(`Supabase CLI linked unexpected project ${linkedRef || "(empty)"}`)
  }
  const url = new URL(poolerUrl)
  const approvedHost = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
  if (url.protocol !== "postgresql:" || !approvedHost) {
    throw new Error("Linked target must use the approved Supabase pooler domain")
  }
  if (url.username !== `postgres.${projectRef}` || url.password) {
    throw new Error("Linked target must use the expected password-free project user")
  }
  if (url.port !== "5432" || url.pathname !== "/postgres") {
    throw new Error("Linked target must use the IPv4 session pooler database")
  }
  if (url.search || url.hash) {
    throw new Error("Linked target must not contain query or fragment data")
  }
}
