export type RelationKind = "table" | "view" | "materialized view"

type RelationAction = {
  index: number
  operation:
    | "create" | "create_temporary" | "drop" | "drop_schema"
    | "rename_schema" | "move" | "rename"
  kind?: RelationKind
  name: string
  target?: string
}

export function replayRelationInventory(
  migrations: Map<string, string>,
): Map<string, RelationKind> {
  const inventory = new Map<string, RelationKind>()
  for (const [file, source] of migrations) {
    const actions: RelationAction[] = []
    for (const match of source.matchAll(
      /^\s*create\s+(?:or\s+replace\s+)?(?:unlogged\s+)?(table|(?:materialized\s+)?view)\s+(?:if\s+not\s+exists\s+)?([a-z_"][a-z0-9_"]*\.[a-z_"][a-z0-9_"]*)/gim,
    )) actions.push({
      index: match.index,
      operation: "create",
      kind: match[1].toLowerCase() as RelationKind,
      name: match[2],
    })
    for (const match of source.matchAll(
      /^\s*create\s+(?:temporary|temp)\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_"][a-z0-9_"]*(?:\.[a-z_"][a-z0-9_"]*)?)/gim,
    )) actions.push({
      index: match.index, operation: "create_temporary", name: match[1],
    })
    for (const match of source.matchAll(
      /^\s*drop\s+(table|(?:materialized\s+)?view)\s+(?:if\s+exists\s+)?([^;]+);/gim,
    )) {
      const targets = match[2].replace(/\s+(?:cascade|restrict)\s*$/i, "").split(",")
      for (const target of targets) {
        const name = target.trim()
        if (!/^[a-z_"][a-z0-9_"]*\.[a-z_"][a-z0-9_"]*$/i.test(name)) {
          throw new Error(`${file}: unsupported relation drop target ${name}`)
        }
        actions.push({ index: match.index, operation: "drop", name })
      }
    }
    for (const match of source.matchAll(
      /^\s*drop\s+schema\s+(?:if\s+exists\s+)?([a-z_"][a-z0-9_"]*)\s+(?:cascade|restrict)\s*;/gim,
    )) actions.push({ index: match.index, operation: "drop_schema", name: match[1] })
    for (const match of source.matchAll(
      /^\s*alter\s+schema\s+([a-z_"][a-z0-9_"]*)\s+rename\s+to\s+([a-z_"][a-z0-9_"]*)/gim,
    )) actions.push({
      index: match.index, operation: "rename_schema", name: match[1], target: match[2],
    })
    for (const match of source.matchAll(
      /^\s*alter\s+(?:table|(?:materialized\s+)?view)\s+(?:if\s+exists\s+)?([a-z_"][a-z0-9_"]*\.[a-z_"][a-z0-9_"]*)\s+set\s+schema\s+([a-z_"][a-z0-9_"]*)/gim,
    )) actions.push({
      index: match.index, operation: "move", name: match[1], target: match[2],
    })
    for (const match of source.matchAll(
      /^\s*alter\s+(?:table|(?:materialized\s+)?view)\s+(?:if\s+exists\s+)?([a-z_"][a-z0-9_"]*\.[a-z_"][a-z0-9_"]*)\s+rename\s+to\s+([a-z_"][a-z0-9_"]*)/gim,
    )) actions.push({
      index: match.index, operation: "rename", name: match[1], target: match[2],
    })
    const identityStatements = [
      ...source.matchAll(
        /^\s*create\s+(?:or\s+replace\s+)?(?:(?:unlogged|temporary|temp|foreign)\s+)?(?:table|(?:materialized\s+)?view)\b/gim,
      ),
      ...source.matchAll(
        /^\s*drop\s+(?:(?:materialized\s+)?view|table|schema)\b/gim,
      ),
      ...source.matchAll(
        /^\s*alter\s+(?:(?:materialized\s+)?view|table)\b[^;]*\b(?:set\s+schema|rename\s+to)\b/gim,
      ),
    ]
    for (const statement of identityStatements) {
      if (actions.some((action) => action.index === statement.index)) continue
      const line = source.slice(0, statement.index).split("\n").length
      throw new Error(`${file}:${line}: unsupported persistent relation DDL`)
    }
    actions.sort((left, right) => left.index - right.index)
    for (const action of actions) {
      const name = action.name.toLowerCase().replaceAll('"', "")
      const target = action.target?.toLowerCase().replaceAll('"', "")
      if (action.operation === "rename_schema") {
        for (const [relation, kind] of [...inventory]) {
          if (!relation.startsWith(`${name}.`)) continue
          inventory.delete(relation)
          inventory.set(`${target}.${relation.slice(name.length + 1)}`, kind)
        }
        continue
      }
      if (action.operation === "drop_schema") {
        for (const relation of [...inventory.keys()]) {
          if (relation.startsWith(`${name}.`)) inventory.delete(relation)
        }
        continue
      }
      if (action.operation === "create_temporary") continue
      if (action.operation === "create") inventory.set(name, action.kind!)
      if (action.operation === "drop") inventory.delete(name)
      if (action.operation === "move" || action.operation === "rename") {
        const kind = inventory.get(name)
        if (!kind) throw new Error(`${file}: cannot ${action.operation} unknown relation ${name}`)
        const [beforeSchema, relation] = name.split(".")
        const after = action.operation === "move"
          ? `${target}.${relation}`
          : `${beforeSchema}.${target}`
        inventory.delete(name)
        inventory.set(after, kind)
      }
    }
  }
  return new Map(
    [...inventory].sort(([left], [right]) => left.localeCompare(right)),
  )
}
