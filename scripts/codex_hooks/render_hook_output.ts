import type { PostWriteDiagnostic } from "./types.ts"

export function renderHookOutput(
  diagnostics: PostWriteDiagnostic[],
): Record<string, unknown> | null {
  if (diagnostics.length === 0) return null
  const errors = diagnostics.filter((item) => item.severity === "error").length
  const advisories = diagnostics.length - errors
  return {
    systemMessage: `MoMi post-write diagnostics: ${errors} error(s), ` +
      `${advisories} advisory item(s).`,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: JSON.stringify({ schema_version: 1, diagnostics }),
    },
  }
}
