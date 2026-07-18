import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import * as ts from "typescript"

import type { LoadedFunction, WorkspaceConfig } from "./types.ts"

export async function findAdapterViolations(
  workspace: WorkspaceConfig,
  functions: LoadedFunction[],
): Promise<string[]> {
  const violations: string[] = []

  for (const loadedFunction of functions) {
    const path = join(loadedFunction.adapter_directory, "index.ts")
    const source = await readFile(path, "utf8")
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    const edgeImport = parsed.statements[0]
    const handlerImport = parsed.statements[1]
    const edgeOnly = ts.isImportDeclaration(edgeImport) && !edgeImport.importClause &&
      ts.isStringLiteral(edgeImport.moduleSpecifier) &&
      edgeImport.moduleSpecifier.text === "edge-runtime"
    const binding = ts.isImportDeclaration(handlerImport) && handlerImport.importClause
      ?.namedBindings
    const elements = binding && ts.isNamedImports(binding) ? binding.elements : []
    const exactBinding = elements.length === 1 && elements[0].name.text === "handleRequest" &&
      !elements[0].propertyName
    const registration = parsed.statements[2]
    const registrationOnly = parsed.statements.length === 3 &&
      ts.isExpressionStatement(registration) &&
      registration.expression.getText(parsed) === "Deno.serve(handleRequest)"
    if (!edgeOnly || !exactBinding || !registrationOnly) {
      violations.push(`${loadedFunction.slug}: adapter must only register handleRequest`)
    }
    if (workspace.layout === "service_workspaces") {
      const expected = `../../../services/${loadedFunction.service.manifest.service_key}` +
        `/functions/${loadedFunction.slug}/src/handle_request.ts`
      const specifier = ts.isImportDeclaration(handlerImport) &&
          ts.isStringLiteral(handlerImport.moduleSpecifier)
        ? handlerImport.moduleSpecifier.text
        : ""
      if (specifier !== expected) {
        violations.push(`${loadedFunction.slug}: adapter must import ${expected}`)
      }
      const entries = await readdir(loadedFunction.adapter_directory)
      const unexpected = entries.filter((entry) =>
        entry !== "index.ts" && entry !== "deno.json"
      )
      if (unexpected.length > 0) {
        violations.push(`${loadedFunction.slug}: adapter contains ${unexpected.join(", ")}`)
      }
    }
  }

  return violations
}
