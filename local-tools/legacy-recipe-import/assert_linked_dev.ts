import { join } from "node:path"

import {
  DEV_PROJECT_REF, PINNED_SUPABASE_CLI_VERSION,
} from "./constants.ts"
import { decodeUtf8 } from "./decode_utf8.ts"
import { readSealedBytes } from "./read_sealed_bytes.ts"

export async function assertLinkedDev(workspaceRoot: string): Promise<void> {
  const workspace = JSON.parse(decodeUtf8(
    await readSealedBytes(join(workspaceRoot, "workspace.json")), "workspace.json",
  )) as {
    environments?: { dev?: { project_ref?: string } }
    toolchain?: { supabase_cli?: string }
  }
  if (workspace.environments?.dev?.project_ref !== DEV_PROJECT_REF ||
    workspace.toolchain?.supabase_cli !== PINNED_SUPABASE_CLI_VERSION) {
    throw new Error("Workspace is not pinned to the approved development project and CLI")
  }
  const linked = decodeUtf8(await readSealedBytes(join(
    workspaceRoot, "supabase", ".temp", "project-ref",
  )), "supabase/.temp/project-ref").trim()
  if (linked !== DEV_PROJECT_REF) {
    throw new Error("Supabase CLI is not linked to the approved development project")
  }
}
