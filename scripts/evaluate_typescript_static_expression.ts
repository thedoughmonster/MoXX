import * as ts from "typescript"
import {
  STATIC_DATE,
  STATIC_DATE_PARSE,
  STATIC_DATE_UTC,
  STATIC_GLOBAL_THIS,
  type TypescriptStaticScope,
  type TypescriptStaticValue,
} from "./typescript_static_value.ts"

export function evaluateTypescriptStaticExpression(
  node: ts.Expression,
  scope: TypescriptStaticScope,
): TypescriptStaticValue | undefined {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (ts.isIdentifier(node)) return scope.get(node.text)
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluateTypescriptStaticExpression(node.expression, scope)
  }
  if (ts.isParenthesizedExpression(node)) {
    return evaluateTypescriptStaticExpression(node.expression, scope)
  }
  if (ts.isPrefixUnaryExpression(node)) {
    const value = evaluateTypescriptStaticExpression(node.operand, scope)
    if (typeof value !== "number") return undefined
    if (node.operator === ts.SyntaxKind.MinusToken) return -value
    if (node.operator === ts.SyntaxKind.PlusToken) return value
    return undefined
  }
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map((element) => ts.isExpression(element)
      ? evaluateTypescriptStaticExpression(element, scope) : undefined)
    return values.every((value) => value !== undefined)
      ? values as TypescriptStaticValue[] : undefined
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text
    for (const span of node.templateSpans) {
      const expression = evaluateTypescriptStaticExpression(span.expression, scope)
      if (typeof expression !== "string" && typeof expression !== "number") return undefined
      value += String(expression) + span.literal.text
    }
    return value
  }
  if (ts.isBinaryExpression(node)) {
    const left = evaluateTypescriptStaticExpression(node.left, scope)
    const right = evaluateTypescriptStaticExpression(node.right, scope)
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      ["string", "number"].includes(typeof left) &&
      ["string", "number"].includes(typeof right)) {
      return typeof left === "string" || typeof right === "string"
        ? String(left) + String(right) : Number(left) + Number(right)
    }
    if (typeof left !== "number" || typeof right !== "number") return undefined
    if (node.operatorToken.kind === ts.SyntaxKind.MinusToken) return left - right
    if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return left * right
    if (node.operatorToken.kind === ts.SyntaxKind.SlashToken) return left / right
    return undefined
  }
  if (ts.isPropertyAccessExpression(node)) {
    const receiver = evaluateTypescriptStaticExpression(node.expression, scope)
    if (receiver === STATIC_GLOBAL_THIS && node.name.text === "Date") return STATIC_DATE
    if (receiver === STATIC_DATE && node.name.text === "parse") return STATIC_DATE_PARSE
    if (receiver === STATIC_DATE && node.name.text === "UTC") return STATIC_DATE_UTC
    return undefined
  }
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const receiver = evaluateTypescriptStaticExpression(node.expression, scope)
    const name = evaluateTypescriptStaticExpression(node.argumentExpression, scope)
    if (receiver === STATIC_GLOBAL_THIS && name === "Date") return STATIC_DATE
    if (receiver === STATIC_DATE && name === "parse") return STATIC_DATE_PARSE
    if (receiver === STATIC_DATE && name === "UTC") return STATIC_DATE_UTC
    return undefined
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "join") {
    const values = evaluateTypescriptStaticExpression(node.expression.expression, scope)
    const separator = node.arguments.length === 0 ? "," :
      evaluateTypescriptStaticExpression(node.arguments[0], scope)
    if (Array.isArray(values) && typeof separator === "string" &&
      values.every((value) => typeof value === "string" || typeof value === "number")) {
      return values.map(String).join(separator)
    }
  }
  return undefined
}
