import type { PostWriteDiagnostic } from "./types.ts"
import { renderRepositoryDiagnostics } from
  "../diagnostics/render_repository_diagnostics.ts"

export const hookAdditionalContextLimit = 4000

export function renderHookOutput(
  diagnostics: PostWriteDiagnostic[],
): Record<string, unknown> | null {
  if (diagnostics.length === 0) return null
  const errors = diagnostics.filter((item) => item.severity === "error").length
  const advisories = diagnostics.length - errors
  const repositoryDiagnostics = diagnostics.flatMap((item) =>
    item.repository_diagnostic ? [item.repository_diagnostic] : []
  )
  const unadaptedDiagnostics = diagnostics.filter((item) =>
    !item.repository_diagnostic
  )
  const rendered = renderRepositoryDiagnostics(repositoryDiagnostics)
  const payload: Record<string, unknown> = {
    schema_version: 1,
    rendered_diagnostics: rendered,
    unadapted_diagnostics: unadaptedDiagnostics,
  }
  let additionalContext = JSON.stringify(payload)
  if (additionalContext.length > hookAdditionalContextLimit) {
    const marker = unadaptedDiagnostics.length === 0
      ? "[truncated: adapted locations omitted; run pnpm momi-check changed for repository enforcement]"
      : "[truncated: hook-only diagnostic details omitted; run pnpm momi-check changed for repository enforcement]"
    const lines = rendered.trimEnd().split("\n")
    payload.unadapted_diagnostics = []
    payload.truncation = {
      limit: hookAdditionalContextLimit,
      adapted_count: repositoryDiagnostics.length,
      unadapted_count: unadaptedDiagnostics.length,
      details_omitted: true,
      repository_validation_command: "pnpm momi-check changed",
    }
    do {
      payload.rendered_diagnostics = `${lines.join("\n")}\n${marker}\n`
      additionalContext = JSON.stringify(payload)
      if (additionalContext.length > hookAdditionalContextLimit) lines.pop()
    } while (additionalContext.length > hookAdditionalContextLimit && lines.length > 0)
    if (additionalContext.length > hookAdditionalContextLimit) {
      payload.rendered_diagnostics = `${marker}\n`
      additionalContext = JSON.stringify(payload)
    }
  }
  return {
    systemMessage: `MoMi post-write diagnostics: ${errors} error(s), ` +
      `${advisories} advisory item(s).`,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext,
    },
  }
}
