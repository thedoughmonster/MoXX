import { extractCodexEditPaths } from "../extract_codex_edit_paths.ts"
import { isQualityMetricsInput } from "../quality/is_quality_metrics_input.ts"
import { inspectChangedFile } from "./inspect_changed_file.ts"
import { runCanonicalGenerator } from "./run_canonical_generator.ts"
import { shouldGenerateCatalog } from "./should_generate_catalog.ts"
import type {
  CanonicalGenerator,
  HookEvent,
  PostWriteDiagnostic,
  PostWriteOptions,
} from "./types.ts"

export async function runPostWriteDiagnostics(
  event: HookEvent,
  options: PostWriteOptions,
): Promise<PostWriteDiagnostic[]> {
  if (event.hook_event_name !== "PostToolUse" || event.tool_name !== "apply_patch") {
    return []
  }
  const command = event.tool_input?.command
  if (typeof command !== "string") {
    return [{
      code: "POST_WRITE_HOOK_INPUT_INVALID",
      path: "(hook)",
      severity: "error",
      evidence: { message: "tool_input.command must be a string" },
      repair_class: "SEMANTIC_REPAIR",
    }]
  }
  let paths: string[]
  try {
    paths = extractCodexEditPaths(event, options.root)
  } catch (error) {
    return [{
      code: "POST_WRITE_HOOK_INPUT_INVALID",
      path: "(hook)",
      severity: "error",
      evidence: {
        message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      },
      repair_class: "SEMANTIC_REPAIR",
    }]
  }
  const diagnostics: PostWriteDiagnostic[] = []
  for (const path of paths) {
    try {
      diagnostics.push(...await inspectChangedFile(options.root, path, options.policies))
    } catch (error) {
      diagnostics.push({
        code: "POST_WRITE_INSPECTOR_FAILURE",
        path,
        severity: "error",
        evidence: {
          message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        },
        repair_class: "SEMANTIC_REPAIR",
      })
    }
  }
  const generators: CanonicalGenerator[] = []
  if (paths.some(shouldGenerateCatalog)) generators.push("catalog")
  if (paths.some(isQualityMetricsInput)) generators.push("quality")
  const runGenerator = options.runGenerator ?? runCanonicalGenerator
  for (const kind of generators) {
    try {
      const result = await runGenerator(options.root, kind)
      if (!result.changed) continue
      diagnostics.push({
        code: kind === "catalog"
          ? "GENERATED_SERVICE_CATALOG_UPDATED"
          : "GENERATED_QUALITY_METRICS_UPDATED",
        path: result.path,
        severity: "advisory",
        evidence: { command: result.command, trigger_paths: paths },
        repair_class: "AUTO_FIX",
      })
    } catch (error) {
      diagnostics.push({
        code: "POST_WRITE_GENERATOR_FAILURE",
        path: kind === "catalog"
          ? "docs/service-catalog.md"
          : "docs/quality-metrics.json",
        severity: "error",
        evidence: {
          generator: kind,
          message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        },
        repair_class: "SEMANTIC_REPAIR",
      })
    }
  }
  return diagnostics
}
