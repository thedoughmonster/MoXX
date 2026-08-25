import { normalizeSqlIdentifiers } from "../sql/normalize_sql_identifiers.ts"
import { buildRoutineIdentity } from "../sql/build_routine_identity.ts"
import { splitSqlStatements } from "../sql/split_sql_statements.ts"

export type RoutineAction = {
  index: number
  operation: "create" | "drop" | "drop_schema" | "rename_schema"
  name: string
  identity?: string
  source?: string
  target?: string
}

export function collectRoutineActions(
  file: string,
  rawSource: string,
): RoutineAction[] {
  const actions: RoutineAction[] = []
  for (const statement of splitSqlStatements(rawSource)) {
    const source = normalizeSqlIdentifiers(statement.text).trim()
    const create = source.match(
      /^create\s+(?:or\s+replace\s+)?(?:function|procedure|routine)\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)/i,
    )
    const drop = source.match(
      /^drop\s+(?:function|procedure|routine)\s+(?:if\s+exists\s+)?(.+?)\s*;?$/is,
    )
    const renameSchema = source.match(
      /^alter\s+schema\s+([a-z_][a-z0-9_]*)\s+rename\s+to\s+([a-z_][a-z0-9_]*)/i,
    )
    const dropSchema = source.match(
      /^drop\s+schema\s+(?:if\s+exists\s+)?(.+?)(?:\s+(?:cascade|restrict))?\s*;?$/i,
    )
    if (create) actions.push({
      index: statement.index,
      operation: "create",
      name: create[1].toLowerCase(),
      identity: buildRoutineIdentity(source, create[1], file),
      source: statement.text,
    })
    else if (drop) {
      let depth = 0
      let start = 0
      const targets: string[] = []
      for (let index = 0; index < drop[1].length; index += 1) {
        const character = drop[1][index]
        if (character === "(") depth += 1
        if (character === ")") depth -= 1
        if (character === "," && depth === 0) {
          targets.push(drop[1].slice(start, index))
          start = index + 1
        }
      }
      targets.push(drop[1].slice(start))
      for (const target of targets) {
        const normalizedTarget = target.trim()
        const name = normalizedTarget.match(
          /^([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\b/i,
        )?.[1]
        if (!name) throw new Error(`${file}: unsupported routine drop target ${target.trim()}`)
        actions.push({
          index: statement.index,
          operation: "drop",
          name: name.toLowerCase(),
          identity: normalizedTarget.includes("(")
            ? buildRoutineIdentity(normalizedTarget, name, file)
            : undefined,
        })
      }
    } else if (renameSchema) actions.push({
      index: statement.index,
      operation: "rename_schema",
      name: renameSchema[1],
      target: renameSchema[2],
    })
    else if (dropSchema) for (const value of dropSchema[1].split(",")) {
      const name = value.trim()
      if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
        throw new Error(`${file}: unsupported schema drop target ${name}`)
      }
      actions.push({ index: statement.index, operation: "drop_schema", name })
    }
    else if (/^(?:create\s+(?:or\s+replace\s+)?|drop\s+)(?:function|procedure|routine)\b|^alter\s+(?:function|procedure|routine)\b[\s\S]*\b(?:rename\s+to|set\s+schema)\b/i.test(source)) {
      const line = rawSource.slice(0, statement.index).split("\n").length
      throw new Error(`${file}:${line}: unsupported persistent routine DDL`)
    }
  }
  return actions
}
