import { DEV_PROJECT_REF } from "./constants.ts"

export function buildSupabaseLinkArgs(workspaceRoot: string): string[] {
  return [
    "link", "--project-ref", DEV_PROJECT_REF,
    "--workdir", workspaceRoot, "--yes",
  ]
}
