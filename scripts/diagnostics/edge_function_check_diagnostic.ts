import { join, relative, sep } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import type { LoadedFunction } from "../architecture/types.ts"
import type { RepositoryDiagnosticV1 } from "./types.ts"

export function edgeFunctionCheckDiagnostic(
  loaded: LoadedFunction,
  stage: "type" | "lint",
): RepositoryDiagnosticV1 {
  const entrypoint = join(loaded.adapter_directory, "index.ts")
  const target = stage === "type" ? entrypoint : loaded.source_directory
  const path = relative(workspaceRoot, target).split(sep).join("/")
  const config = relative(
    workspaceRoot,
    join(loaded.adapter_directory, "deno.json"),
  ).split(sep).join("/")
  const source = relative(workspaceRoot, loaded.source_directory)
    .split(sep).join("/")
  const ruleId = stage === "type"
    ? "EDGE_FUNCTION_TYPE_CHECK"
    : "EDGE_FUNCTION_LINT"
  return {
    schema_version: 1,
    rule_id: ruleId,
    enforcement: "hard_stop",
    location: { path },
    violated_rule: stage === "type"
      ? "A repository-owned Edge Function must pass its declared Deno type check."
      : "A repository-owned Edge Function must pass its declared Deno lint check.",
    rationale: `Function ${loaded.manifest.function_key} is owned by ` +
      `${loaded.manifest.owner_service}; config ${config}; source ${source}.`,
    expected: stage === "type"
      ? "Use the native Deno output to restore a passing type check within the " +
        "declared config, adapter, and owning service boundary."
      : "Use the native Deno output to restore a passing lint check within the " +
        "declared config, adapter, and owning service boundary.",
    repair: { kind: "none" },
    validation_command: "pnpm edge:check",
    fingerprint: {
      group: { rule_id: ruleId, stage },
      instance: {
        function_key: loaded.manifest.function_key,
        owner_service: loaded.manifest.owner_service,
        path,
      },
    },
  }
}
