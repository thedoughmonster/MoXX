export type RelationAccess = "read" | "write"

export function findRelationAccess(
  source: string,
  relation: string,
): RelationAccess | undefined {
  const escaped = relation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const reference = new RegExp(
    `(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`,
    "i",
  )
  if (!reference.test(source)) return undefined
  const read = new RegExp(
    `(?:\\b(?:from|join|using)\\s+|,\\s*)(?:only\\s+)?${escaped}\\b`,
    "i",
  ).test(source)
  const mutations = [
    `\\b(?:insert\\s+into|update|delete\\s+from|merge\\s+into|` +
      `alter\\s+(?:table|(?:materialized\\s+)?view)|` +
      `create\\s+(?:or\\s+replace\\s+)?` +
      `(?:unlogged\\s+)?(?:table|(?:materialized\\s+)?view))\\s+` +
      `(?:if\\s+(?:not\\s+)?exists\\s+)?(?:only\\s+)?${escaped}\\b`,
    `\\b(?:truncate(?:\\s+table)?|drop\\s+(?:table|` +
      `(?:materialized\\s+)?view))\\b[^;]*\\b${escaped}\\b`,
    `\\b(?:comment\\s+on|security\\s+label\\s+on)\\s+` +
      `(?:table|(?:materialized\\s+)?view)\\s+${escaped}\\b`,
    `\\b(?:grant|revoke)\\b[^;]*\\bon\\s+(?:table\\s+)?` +
      `[^;]*\\b${escaped}\\b`,
    `\\b(?:create|alter|drop)\\s+(?:or\\s+replace\\s+)?` +
      `(?:policy|trigger)\\b[^;]*\\bon\\s+${escaped}\\b`,
    `\\bcreate\\s+(?:or\\s+replace\\s+)?rule\\b[^;]*\\bto\\s+${escaped}\\b`,
    `\\bcreate\\s+(?:unique\\s+)?index\\b[^;]*\\bon\\s+` +
      `(?:only\\s+)?${escaped}\\b`,
    `\\b(?:refresh\\s+materialized\\s+view|reindex(?:\\s+table)?|cluster|` +
      `vacuum|analyze|lock\\s+table|copy)\\b[^;]*\\b${escaped}\\b`,
  ]
  const mutation = mutations.some((pattern) => new RegExp(pattern, "i").test(source))
  return mutation || !read ? "write" : "read"
}
