import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { splitSqlStatements } from "../sql/split_sql_statements.ts"
import type { RelationKind } from "./replay_relation_inventory.ts"

export type RelationAction = {
  index: number
  operation:
    | "create" | "create_temporary" | "drop" | "drop_schema"
    | "rename_schema" | "move" | "rename"
  kind?: RelationKind
  name: string
  source?: string
  target?: string
}

export function collectRelationActions(
  file: string,
  rawSource: string,
): RelationAction[] {
  const actions: RelationAction[] = []
  for (const statement of splitSqlStatements(rawSource)) {
    const source = normalizeSqlIdentifiers(statement.text).trim()
    const create = source.match(
      /^create\s+(?:or\s+replace\s+)?(unlogged\s+)?(table|materialized\s+view|(?:recursive\s+)?view)\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)/i,
    )
    const temporary = source.match(
      /^create\s+(?:temporary|temp)\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/i,
    )
    const drop = source.match(
      /^drop\s+(table|(?:materialized\s+)?view)\s+(?:if\s+exists\s+)?(.+?)(?:\s+(?:cascade|restrict))?\s*;?$/is,
    )
    const dropSchema = source.match(
      /^drop\s+schema\s+(?:if\s+exists\s+)?(.+?)(?:\s+(?:cascade|restrict))?\s*;?$/i,
    )
    const renameSchema = source.match(
      /^alter\s+schema\s+([a-z_][a-z0-9_]*)\s+rename\s+to\s+([a-z_][a-z0-9_]*)/i,
    )
    const alter = source.match(
      /^alter\s+(?:table|(?:materialized\s+)?view)\s+(?:if\s+exists\s+)?(?:only\s+)?([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s+(set\s+schema|rename\s+to)\s+([a-z_][a-z0-9_]*)/i,
    )
    if (create) actions.push({
      index: statement.index,
      operation: "create",
      kind: create[2].toLowerCase().replace("recursive ", "") as RelationKind,
      name: create[3].toLowerCase(),
      source: statement.text,
    })
    else if (temporary) actions.push({
      index: statement.index, operation: "create_temporary", name: temporary[1],
    })
    else if (drop) {
      for (const target of drop[2].split(",")) {
        const name = target.trim()
        if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(name)) {
          throw new Error(`${file}: unsupported relation drop target ${name}`)
        }
        actions.push({ index: statement.index, operation: "drop", name })
      }
    } else if (dropSchema) for (const value of dropSchema[1].split(",")) {
      const name = value.trim()
      if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
        throw new Error(`${file}: unsupported schema drop target ${name}`)
      }
      actions.push({ index: statement.index, operation: "drop_schema", name })
    }
    else if (renameSchema) actions.push({
      index: statement.index, operation: "rename_schema",
      name: renameSchema[1], target: renameSchema[2],
    })
    else if (alter) actions.push({
      index: statement.index,
      operation: alter[2].toLowerCase().startsWith("set") ? "move" : "rename",
      name: alter[1], target: alter[3],
    })
    else if (/^(?:create\s+(?:or\s+replace\s+)?(?:(?:unlogged|foreign)\s+)?(?:table|(?:materialized\s+|recursive\s+)?view)|drop\s+(?:table|(?:materialized\s+)?view|schema)|alter\s+(?:table|(?:materialized\s+)?view)\b[\s\S]*\b(?:set\s+schema|rename\s+to))\b/i.test(source)) {
      const line = rawSource.slice(0, statement.index).split("\n").length
      throw new Error(`${file}:${line}: unsupported persistent relation DDL`)
    }
  }
  return actions
}
