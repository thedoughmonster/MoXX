import * as ts from "typescript"
type SqlCallableKind = "execute" | "query" | "sql" | "unsafe"
export function findDynamicSqlExpressions(path: string, source: string): string[] {
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true,
    ts.ScriptKind.TS)
  const expressions = new Set<string>()
  const sqlTags = new Set<string>()
  const calls: Array<{ node: ts.CallExpression; text: string }> = []
  const aliases: Array<{ kind?: SqlCallableKind; source?: string; target: string }> = []
  const pending: ts.Node[] = [parsed]
  const relationPrefix = /\b(?:from|join|insert\s+into|update|delete\s+from|merge\s+into|truncate(?:\s+table)?)\s*(?:\/\*[\s\S]*?\*\/\s*|--[^\r\n]*(?:\r?\n|$)\s*)*$/i
  const unwrapCallable = (node: ts.Expression): ts.Expression => {
    let expression = node
    while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression))
      expression = expression.expression
    if (ts.isCallExpression(expression) &&
      ts.isPropertyAccessExpression(expression.expression) &&
      expression.expression.name.text === "bind") {
      expression = expression.expression.expression
    }
    while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression))
      expression = expression.expression
    return expression
  }
  const directKind = (node: ts.Expression): SqlCallableKind | undefined => {
    const expression = unwrapCallable(node)
    if (ts.isIdentifier(expression) && expression.text === "sql") return "sql"
    let name: string | undefined
    if (ts.isPropertyAccessExpression(expression)) name = expression.name.text
    if (ts.isElementAccessExpression(expression) && expression.argumentExpression &&
      ts.isStringLiteralLike(expression.argumentExpression))
      name = expression.argumentExpression.text
    return ["execute", "query", "unsafe"].includes(name ?? "")
      ? name as SqlCallableKind : undefined
  }
  const recordAlias = (target: string, node: ts.Expression): void => {
    const expression = unwrapCallable(node)
    const aliasSource = ts.isIdentifier(expression) ? expression.text : undefined
    aliases.push({ kind: directKind(node), source: aliasSource, target })
  }
  while (pending.length > 0) {
    const node = pending.pop() as ts.Node
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) recordAlias(node.name.text, node.initializer)
      if (ts.isObjectBindingPattern(node.name)) for (const element of node.name.elements) {
        const property = element.propertyName?.getText(parsed) ?? element.name.getText(parsed)
        if (["execute", "query", "unsafe"].includes(property) &&
          ts.isIdentifier(element.name)) aliases.push({
          kind: property as SqlCallableKind, target: element.name.text,
        })
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind ===
      ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
      recordAlias(node.left.text, node.right)
    }
    if (ts.isCallExpression(node)) calls.push({ node, text: node.getText(parsed) })
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag.getText(parsed).replace(/<[^<>]*>$/, "")
      const template = node.template.getText(parsed)
      if (/\b(?:select|insert|update|delete|merge|with|create|alter|drop|grant|revoke)\b/i
        .test(template)) sqlTags.add(tag)
      if (ts.isTemplateExpression(node.template)) {
        let prefix = node.template.head.text
        for (const span of node.template.templateSpans) {
          const value = span.expression.getText(parsed)
          const identifierPosition = relationPrefix.test(prefix) ||
            /[a-z0-9_"']\s*\.\s*$/i.test(prefix) ||
            /\b(?:from|join|into|update)\s+["']?$/i.test(prefix)
          if (identifierPosition && !value.startsWith("sql(")) {
            expressions.add(`\${${value}}`)
          }
          prefix += `\${}` + span.literal.text
        }
      }
    }
    pending.push(...node.getChildren(parsed))
  }
  const resolved = new Map<string, SqlCallableKind>()
  for (let pass = 0; pass <= aliases.length; pass += 1) for (const alias of aliases) {
    const kind = alias.kind ?? (alias.source ? resolved.get(alias.source) : undefined)
    if (kind) resolved.set(alias.target, kind)
  }
  for (const call of calls) {
    const callee = call.node.expression.getText(parsed)
    const rawCallable = unwrapCallable(call.node.expression)
    const method = ts.isPropertyAccessExpression(rawCallable) &&
      ["call", "apply"].includes(rawCallable.name.text) ? rawCallable.name.text : undefined
    const callable = method ? rawCallable.expression : rawCallable
    const key = callable.getText(parsed)
    const computed = ts.isElementAccessExpression(callable) && callable.argumentExpression &&
      !ts.isStringLiteralLike(callable.argumentExpression)
    const base = computed ? unwrapCallable(callable.expression) : undefined
    const computedSql = base && (directKind(base) === "sql" ||
      (ts.isIdentifier(base) && resolved.get(base.text) === "sql"))
    const kind = computedSql ? "unsafe" : directKind(callable) ??
      resolved.get(ts.isIdentifier(callable) ? callable.text : key)
    const argument = call.node.arguments[method ? 1 : 0]
    const applied = method === "apply" && ts.isArrayLiteralExpression(argument)
      ? argument.elements[0] : argument
    const dynamic = method === "apply"
      ? !applied || (!ts.isStringLiteral(applied) &&
        !ts.isNoSubstitutionTemplateLiteral(applied))
      : !!applied && !ts.isStringLiteral(applied) &&
        !ts.isNoSubstitutionTemplateLiteral(applied)
    if (kind === "sql") {
      expressions.add(callee === "sql"
        ? `sql(${applied?.getText(parsed) ?? ""})`
        : `${callee}(...)`)
    } else if (kind === "unsafe" ||
      ((kind === "query" || kind === "execute") && dynamic)) {
      expressions.add(`${callee}(...)`)
    }
    if (!kind && sqlTags.has(callee)) expressions.add(call.text)
  }
  for (const match of source.matchAll(/\bU&\s*"[^"\r\n]+"/gi)) expressions.add(match[0])
  return [...expressions].sort()
}
