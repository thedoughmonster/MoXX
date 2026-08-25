import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { splitSqlStatements } from "../sql/split_sql_statements.ts"

export type IndexAction = {
  index: number
  operation: "create" | "drop" | "move" | "mutate" | "rename"
  name: string
  relation?: string
  target?: string
}

export function collectIndexActions(file: string, rawSource: string): IndexAction[] {
  const actions: IndexAction[] = []
  for (const statement of splitSqlStatements(rawSource)) {
    const source = normalizeSqlIdentifiers(statement.text).trim()
    const create = source.match(
      /^create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\s+on\s+(?:only\s+)?([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)/i,
    )
    const drop = source.match(
      /^drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(.+?)(?:\s+(?:cascade|restrict))?\s*;?$/is,
    )
    const alter = source.match(
      /^alter\s+index\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s+([\s\S]+?)\s*;?$/i,
    )
    const reindex = source.match(
      /^(?:reindex(?:\s+\([^)]*\))?\s+index\s+(?:concurrently\s+)?|comment\s+on\s+index\s+)([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)/i,
    )
    if (create) {
      const relation = create[2].toLowerCase()
      const name = create[1].includes(".")
        ? create[1].toLowerCase()
        : `${relation.split(".")[0]}.${create[1].toLowerCase()}`
      actions.push({
        index: statement.index, operation: "create", name, relation,
      })
    } else if (drop) for (const value of drop[1].split(",")) {
      const name = value.trim().toLowerCase()
      if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(name)) {
        throw new Error(`${file}: unsupported index drop target ${name}`)
      }
      actions.push({ index: statement.index, operation: "drop", name })
    }
    else if (alter) {
      const clause = alter[2].replace(/;\s*$/, "").trim()
      const rename = clause.match(/^rename\s+to\s+([a-z_][a-z0-9_]*)$/i)
      const move = clause.match(/^set\s+schema\s+([a-z_][a-z0-9_]*)$/i)
      const attach = clause.match(
        /^attach\s+partition\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)$/i,
      )
      if (/^attach\s+partition\b/i.test(clause) && !attach) {
        throw new Error(`${file}: unsupported index partition target ${clause}`)
      }
      actions.push({
        index: statement.index,
        operation: rename ? "rename" : move ? "move" : "mutate",
        name: alter[1].toLowerCase(),
        target: (rename?.[1] ?? move?.[1])?.toLowerCase(),
      })
      if (attach) actions.push({
        index: statement.index, operation: "mutate", name: attach[1].toLowerCase(),
      })
    } else if (reindex) actions.push({
      index: statement.index, operation: "mutate", name: reindex[1].toLowerCase(),
    })
    else if (/^(?:create\s+(?:unique\s+)?index|drop\s+index|alter\s+index|reindex\b|comment\s+on\s+index)\b/i.test(source)) {
      const line = rawSource.slice(0, statement.index).split("\n").length
      throw new Error(`${file}:${line}: unsupported persistent index DDL`)
    }
  }
  return actions
}
