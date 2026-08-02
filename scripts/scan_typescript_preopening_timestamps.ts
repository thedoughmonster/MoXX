import * as ts from "typescript"
import { evaluateTypescriptStaticExpression as evaluate } from "./evaluate_typescript_static_expression.ts"
import { EXECUTABLE_TIMESTAMP_POLICY } from "./executable_timestamp_policy.ts"
import {
  STATIC_DATE,
  STATIC_DATE_PARSE,
  STATIC_DATE_UTC,
  STATIC_GLOBAL_THIS,
  type TypescriptStaticScope,
  type TypescriptStaticValue,
} from "./typescript_static_value.ts"

export function scanTypescriptPreopeningTimestamps(source: string, path: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const findings = new Set<string>()
  const boundaryDate = EXECUTABLE_TIMESTAMP_POLICY.earliestDate
  const boundaryMs = Date.parse(EXECUTABLE_TIMESTAMP_POLICY.earliestTimestampUtc)
  const lineOf = (node: ts.Node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
  const semanticDateName = (name: string) =>
    /date|time|timestamp|expiry|start|end|until|from/i.test(name) ||
    /_at$/i.test(name) || /At$/.test(name)
  const inspectInstant = (value: string | number, node: ts.Node, label: string) => {
    const parsed = typeof value === "number" ? new Date(value).getTime() : Date.parse(value)
    if (!Number.isFinite(parsed) || parsed < boundaryMs) {
      findings.add(`${path}:${lineOf(node)}: ${label} predates or overflows ${boundaryDate}`)
    }
  }
  const inspectString = (value: string, node: ts.Node, semanticName = "") => {
    for (const match of value.matchAll(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\b/g)) {
      inspectInstant(match[0], node, `ISO timestamp ${match[0]}`)
    }
    if (semanticDateName(semanticName) && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      value < boundaryDate) {
      findings.add(`${path}:${lineOf(node)}: named date ${value} predates ${boundaryDate}`)
    }
  }
  const bind = (name: ts.BindingName, value: TypescriptStaticValue | undefined,
    scope: TypescriptStaticScope) => {
    if (ts.isIdentifier(name)) { scope.set(name.text, value); return }
    if (!ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) bind(element.name, undefined, scope)
      }
      return
    }
    for (const element of name.elements) {
      const key = element.propertyName && (ts.isIdentifier(element.propertyName) ||
        ts.isStringLiteral(element.propertyName)) ? element.propertyName.text
        : ts.isIdentifier(element.name) ? element.name.text : ""
      const selected = value === STATIC_DATE && key === "parse" ? STATIC_DATE_PARSE
        : value === STATIC_DATE && key === "UTC" ? STATIC_DATE_UTC
          : value === STATIC_GLOBAL_THIS && key === "Date" ? STATIC_DATE : undefined
      bind(element.name, selected, scope)
    }
  }
  const predeclare = (node: ts.SourceFile | ts.Block, scope: TypescriptStaticScope) => {
    for (const statement of node.statements) {
      if (ts.isVariableStatement(statement) &&
        (statement.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0) {
        for (const declaration of statement.declarationList.declarations) {
          bind(declaration.name, undefined, scope)
        }
      } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) && statement.name) {
        scope.set(statement.name.text, undefined)
      } else if (ts.isImportEqualsDeclaration(statement)) {
        scope.set(statement.name.text, undefined)
      } else if (ts.isImportDeclaration(statement) && statement.importClause) {
        if (statement.importClause.name) scope.set(statement.importClause.name.text, undefined)
        const bindings = statement.importClause.namedBindings
        if (bindings && ts.isNamespaceImport(bindings)) scope.set(bindings.name.text, undefined)
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) scope.set(element.name.text, undefined)
        }
      }
    }
  }
  const assignmentName = (node: ts.Expression) => ts.isIdentifier(node) ? node.text
    : ts.isPropertyAccessExpression(node) ? node.name.text
      : ts.isElementAccessExpression(node) && node.argumentExpression &&
        ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : ""
  const visit = (node: ts.Node, inherited: TypescriptStaticScope) => {
    const scope = node !== file && (ts.isBlock(node) || ts.isFunctionLike(node))
      ? new Map(inherited) : inherited
    if (ts.isSourceFile(node) || ts.isBlock(node)) predeclare(node, scope)
    if (ts.isFunctionLike(node)) {
      for (const parameter of node.parameters) bind(parameter.name, undefined, scope)
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const value = evaluate(node.initializer, scope)
      if (typeof value === "string" && ts.isIdentifier(node.name)) {
        inspectString(value, node.initializer, node.name.text)
      }
      if ((node.parent.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0) {
        bind(node.name, value, scope)
      }
    } else if (ts.isPropertyAssignment(node)) {
      const value = evaluate(node.initializer, scope)
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : ""
      if (typeof value === "string") inspectString(value, node.initializer, name)
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const value = evaluate(node.right, scope)
      if (typeof value === "string") inspectString(value, node.right, assignmentName(node.left))
    }
    if (ts.isExpression(node)) {
      const value = evaluate(node, scope)
      if (typeof value === "string") inspectString(value, node)
    }
    if (ts.isNewExpression(node) && evaluate(node.expression, scope) === STATIC_DATE &&
      node.arguments?.length === 1) {
      const value = evaluate(node.arguments[0], scope)
      if (typeof value === "string" || typeof value === "number") inspectInstant(value, node, "Date")
    }
    if (ts.isCallExpression(node)) {
      const callable = evaluate(node.expression, scope)
      const values = node.arguments.map((argument) => evaluate(argument, scope))
      if (callable === STATIC_DATE_PARSE && values.length === 1 && typeof values[0] === "string") {
        inspectInstant(values[0], node, "Date.parse")
      } else if (callable === STATIC_DATE_UTC && values.length > 0 &&
        values.every((value) => typeof value === "number")) {
        const parsed = Date.UTC(...values as [number, number?, number?, number?, number?, number?, number?])
        inspectInstant(parsed, node, "Date.UTC")
      }
    }
    ts.forEachChild(node, (child) => visit(child, scope))
  }
  const root: TypescriptStaticScope = new Map([
    ["Date", STATIC_DATE], ["globalThis", STATIC_GLOBAL_THIS],
  ])
  visit(file, root)
  return [...findings].sort()
}
