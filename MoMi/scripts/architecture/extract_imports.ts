import * as ts from "typescript"

export const computedImportSpecifier = "<computed-dynamic-import>"

export function extractImports(path: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const imports: string[] = []
  const pending: ts.Node[] = [sourceFile]

  while (pending.length > 0) {
    const node = pending.pop() as ts.Node
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text)
    }
    if (
      ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0]
      imports.push(
        argument && (ts.isStringLiteral(argument) ||
            ts.isNoSubstitutionTemplateLiteral(argument))
          ? argument.text
          : computedImportSpecifier,
      )
    }
    pending.push(...node.getChildren(sourceFile))
  }

  return imports
}
