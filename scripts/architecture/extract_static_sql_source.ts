import * as ts from "typescript"

export function extractStaticSqlSource(path: string, source: string): string {
  const parsed = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const fragments: string[] = []
  const sqlLike = /\b(?:select|insert|update|delete|merge|with|create|alter|drop|grant|revoke|truncate)\b|\b[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\b/i
  const pending: ts.Node[] = [parsed]
  while (pending.length > 0) {
    const node = pending.pop() as ts.Node
    let fragment: string | undefined
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      fragment = node.text
    } else if (ts.isTemplateExpression(node)) {
      fragment = node.head.text
      for (const span of node.templateSpans) {
        fragment += " __dynamic__ " + span.literal.text
      }
    }
    if (fragment && sqlLike.test(fragment)) fragments.push(fragment)
    pending.push(...node.getChildren(parsed))
  }
  return fragments.join(";\n")
}
