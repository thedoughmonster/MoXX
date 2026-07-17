import { readFile } from "node:fs/promises"
import * as ts from "typescript"

export async function readJson<T>(path: string): Promise<T> {
  const source = await readFile(path, "utf8")
  const parsed = ts.parseJsonText(path, source)
  const stack: ts.Expression[] = parsed.statements.map(
    (statement) => statement.expression,
  )
  while (stack.length > 0) {
    const expression = stack.pop()!
    if (ts.isArrayLiteralExpression(expression)) {
      stack.push(...expression.elements)
      continue
    }
    if (!ts.isObjectLiteralExpression(expression)) continue
    const names = new Set<string>()
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) continue
      const name = ts.isStringLiteral(property.name)
        ? property.name.text
        : property.name.getText(parsed)
      if (names.has(name)) {
        throw new Error(`duplicate JSON member ${JSON.stringify(name)}`)
      }
      names.add(name)
      stack.push(property.initializer)
    }
  }
  return JSON.parse(source) as T
}
