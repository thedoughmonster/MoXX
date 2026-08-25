import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { splitSqlStatements } from "../sql/split_sql_statements.ts"
import { collectRelationActions } from
  "../constitution/collect_relation_actions.ts"

export function assertSupportedPersistentDdl(file: string, source: string): void {
  collectRelationActions(file, source)
  for (const statement of splitSqlStatements(source)) {
    const sql = normalizeSqlIdentifiers(statement.text).trim()
    const unsupported = /^(?:select|with)\b[\s\S]*\binto\b/i.test(sql) ||
      /^(?:create\s+(?:(?:temporary|temp)\s+)?|alter\s+|drop\s+)sequence\b/i
        .test(sql) ||
      /\b(?:smallserial|bigserial|serial)\b|\bgenerated\s+(?:always|by\s+default)\s+as\s+identity\b|\bincluding\s+identity\b/i.test(sql) ||
      /^create\s+schema\b[\s\S]*\b(?:create|grant)\b/i.test(sql) ||
      /^alter\s+table\s+all\s+in\s+tablespace\b/i.test(sql) ||
      /^(?:create(?:\s+or\s+replace)?|alter|drop)\s+(?:type|domain|collation|conversion|aggregate|operator(?:\s+(?:class|family))?|cast|transform|statistics|foreign\s+table|publication|subscription|server|foreign\s+data\s+wrapper|user\s+mapping|tablespace|event\s+trigger|access\s+method)\b/i.test(sql)
    if (!unsupported) continue
    const line = source.slice(0, statement.index).split("\n").length
    throw new Error(`${file}:${line}: unsupported persistent relation DDL`)
  }
}
