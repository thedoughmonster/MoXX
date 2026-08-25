import { isAbsolute, relative, resolve } from "node:path"

export interface CodexEditEvent {
  cwd?: unknown
  hook_event_name?: unknown
  tool_input?: unknown
  tool_name?: unknown
}

export function extractCodexEditPaths(
  event: CodexEditEvent,
  repositoryRoot: string,
): string[] {
  const input = event.tool_input && typeof event.tool_input === "object"
    ? event.tool_input as Record<string, unknown>
    : {}
  const candidates: string[] = []
  for (const key of ["file_path", "path", "old_path", "new_path"]) {
    if (typeof input[key] === "string") candidates.push(input[key])
  }
  if (typeof input.command === "string") {
    const headers = input.command.replaceAll("\r\n", "\n").matchAll(
      /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm,
    )
    for (const header of headers) candidates.push(header[1] ?? header[2])
  }
  const cwd = typeof event.cwd === "string" ? event.cwd : repositoryRoot
  const paths = candidates.map((candidate) => {
    const rootRelative = candidate.replace(/^\.\//, "")
      .startsWith("supabase/migrations/")
    const absolute = isAbsolute(candidate)
      ? candidate
      : resolve(rootRelative ? repositoryRoot : cwd, candidate)
    return relative(repositoryRoot, absolute).replaceAll("\\", "/")
  }).filter((path) => path !== "" && path !== ".." && !path.startsWith("../"))
  return [...new Set(paths)]
}
