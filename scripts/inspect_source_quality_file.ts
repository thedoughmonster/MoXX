import { extname } from "node:path"
import * as ts from "typescript"

import { classifyHandwrittenLineCount } from "./classify_handwritten_line_count.ts"
import { isSourceQualityPath } from "./is_source_quality_path.ts"
import type {
  SourceQualityDiagnostic,
  SourceQualityPolicies,
} from "./source_quality_types.ts"

export function inspectSourceQualityFile(
  path: string,
  source: string,
  policies: SourceQualityPolicies,
): SourceQualityDiagnostic[] {
  if (!isSourceQualityPath(path)) return []
  const diagnostics: SourceQualityDiagnostic[] = []
  const normalizedSource = source.replaceAll("\r\n", "\n")
  const lineCount = normalizedSource === "" ? 0 :
    normalizedSource.split("\n").length - (normalizedSource.endsWith("\n") ? 1 : 0)
  if (extname(path) !== ".sql") {
    const lineState = classifyHandwrittenLineCount(
      lineCount,
      policies.max_handwritten_lines,
      policies.hard_max_handwritten_lines,
    )
    if (lineState !== "valid") {
      const hard = lineState === "violation"
      const limit = hard
        ? policies.hard_max_handwritten_lines
        : policies.max_handwritten_lines
      diagnostics.push({
        code: "SOURCE_HANDWRITTEN_LINE_LIMIT",
        path,
        severity: hard ? "error" : "advisory",
        actual: lineCount,
        limit,
        repair_class: "BOUNDED_REFACTOR",
        message: `${path}: ${lineCount} lines (${hard ? "hard" : "soft"} limit ${limit})`,
      })
    }
  }
  if (extname(path) !== ".ts") return diagnostics
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const parseDiagnostics = (parsed as ts.SourceFile & {
    parseDiagnostics: readonly ts.Diagnostic[]
  }).parseDiagnostics
  for (const diagnostic of parseDiagnostics) {
    const location = diagnostic.start === undefined ? undefined :
      parsed.getLineAndCharacterOfPosition(diagnostic.start)
    diagnostics.push({
      code: "SOURCE_TYPESCRIPT_PARSE_FAILURE",
      path,
      severity: "error",
      repair_class: "SEMANTIC_REPAIR",
      line: location === undefined ? undefined : location.line + 1,
      column: location === undefined ? undefined : location.character + 1,
      message: `${path}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
    })
  }
  let functionCount = 0
  for (const statement of parsed.statements) {
    if (ts.isFunctionDeclaration(statement)) functionCount += 1
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))) functionCount += 1
    }
  }
  if (functionCount > 1) {
    diagnostics.push({
      code: "SOURCE_MULTIPLE_TOP_LEVEL_FUNCTIONS",
      path,
      severity: "error",
      actual: functionCount,
      limit: 1,
      repair_class: "BOUNDED_REFACTOR",
      message: `${path}: ${functionCount} top-level functions`,
    })
  }
  return diagnostics
}
