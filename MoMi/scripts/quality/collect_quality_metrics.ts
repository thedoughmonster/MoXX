import { readFile, readdir } from "node:fs/promises"
import { extname, join, relative, sep } from "node:path"
import * as ts from "typescript"

import { workspaceRoot } from "../architecture/paths.ts"
import { isQualityMetricsInput } from "./is_quality_metrics_input.ts"
import type { QualityMetrics } from "./types.ts"

export async function collectQualityMetrics(): Promise<QualityMetrics> {
  const metrics: QualityMetrics = {
    handwritten_files: 0,
    handwritten_lines: 0,
    typescript_files: 0,
    import_declarations: 0,
    top_level_functions: 0,
    branch_complexity_points: 0,
  }
  const entries = await readdir(workspaceRoot, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath, entry.name)
    const relativePath = relative(workspaceRoot, path).replaceAll(sep, "/")
    if (!isQualityMetricsInput(relativePath)) continue
    const source = (await readFile(path, "utf8")).replaceAll("\r\n", "\n")
    metrics.handwritten_files += 1
    metrics.handwritten_lines += source === "" ? 0 :
      source.split("\n").length - (source.endsWith("\n") ? 1 : 0)
    if (extname(path) !== ".ts") continue
    metrics.typescript_files += 1
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    metrics.import_declarations += parsed.statements.filter(ts.isImportDeclaration).length
    for (const statement of parsed.statements) {
      if (ts.isFunctionDeclaration(statement)) metrics.top_level_functions += 1
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (declaration.initializer && (
            ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer)
          )) metrics.top_level_functions += 1
        }
      }
    }
    const visit = (node: ts.Node) => {
      if (
        ts.isIfStatement(node) || ts.isForStatement(node) ||
        ts.isForInStatement(node) || ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) || ts.isDoStatement(node) ||
        ts.isConditionalExpression(node) || ts.isCatchClause(node) ||
        ts.isCaseClause(node)
      ) metrics.branch_complexity_points += 1
      ts.forEachChild(node, visit)
    }
    visit(parsed)
  }
  return metrics
}
