import { readFile, readdir } from "node:fs/promises"
import { extname, join, relative, sep } from "node:path"
import * as ts from "typescript"

import type { WorkspaceConfig } from "./architecture/types.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { classifyHandwrittenLineCount } from "./classify_handwritten_line_count.ts"

const extensions = new Set([".ts", ".md", ".json", ".sql", ".toml", ".yml", ".yaml"])

export type SourceQualityFindings = {
  warnings: string[]
  violations: string[]
}

export async function findSourceQualityFindings(
  workspace: WorkspaceConfig,
): Promise<SourceQualityFindings> {
  const entries = await readdir(workspaceRoot, { recursive: true, withFileTypes: true })
  const warnings: string[] = []
  const violations: string[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !extensions.has(extname(entry.name))) {
      continue
    }
    const path = join(entry.parentPath, entry.name)
    const normalized = relative(workspaceRoot, path).replaceAll(sep, "/")
    if (normalized.startsWith("node_modules/") || normalized === "pnpm-lock.yaml") {
      continue
    }
    const source = await readFile(path, "utf8")
    const normalizedSource = source.replaceAll("\r\n", "\n")
    const lineCount = normalizedSource === "" ? 0 :
      normalizedSource.split("\n").length - (normalizedSource.endsWith("\n") ? 1 : 0)
    if (extname(path) !== ".sql") {
      const lineState = classifyHandwrittenLineCount(
        lineCount,
        workspace.policies.max_handwritten_lines,
        workspace.policies.hard_max_handwritten_lines,
      )
      if (lineState === "violation") {
        violations.push(
          `${normalized}: ${lineCount} lines (hard limit ${workspace.policies.hard_max_handwritten_lines})`,
        )
      } else if (lineState === "warning") {
        warnings.push(
          `${normalized}: ${lineCount} lines (soft limit ${workspace.policies.max_handwritten_lines})`,
        )
      }
    }
    if (extname(path) !== ".ts") {
      continue
    }
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    let functionCount = 0
    for (const statement of parsed.statements) {
      if (ts.isFunctionDeclaration(statement)) {
        functionCount += 1
      }
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (
            declaration.initializer &&
            (ts.isArrowFunction(declaration.initializer) ||
              ts.isFunctionExpression(declaration.initializer))
          ) {
            functionCount += 1
          }
        }
      }
    }
    if (functionCount > 1) {
      violations.push(`${normalized}: ${functionCount} top-level functions`)
    }
  }

  return { warnings, violations }
}
