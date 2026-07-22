import { splitSqlStatements } from "../sql/split_sql_statements.ts"

export function findRoleAuthorityChanges(source: string, allowedRole?: string): string[] {
  const changes: string[] = []
  for (const statement of splitSqlStatements(source)) {
    const sql = statement.text.trim()
    const roleMatch = sql.match(/\b(create|alter|drop)\s+(?:role|user|group)\s+([a-z][a-z0-9_]*)\b/i)
    const declaredCreate = roleMatch?.[1]?.toLowerCase() === "create" &&
      roleMatch[2] === allowedRole && /\bnologin\b/i.test(sql) &&
      /\bnoinherit\b/i.test(sql) && /\bnosuperuser\b/i.test(sql) &&
      /\bnocreatedb\b/i.test(sql) && /\bnocreaterole\b/i.test(sql) &&
      /\bnoreplication\b/i.test(sql) && /\bnobypassrls\b/i.test(sql) &&
      !/\blogin\b/i.test(sql) && !/\bpassword\b/i.test(sql)
    const roleDdl = Boolean(roleMatch) && !declaredCreate
    const owned = /\b(?:drop|reassign)\s+owned\s+by\b/i.test(sql)
    const ownerTransfer = /\balter\b[\s\S]*\bowner\s+to\b/i.test(sql)
    const roleSession = /\b(?:set(?:\s+local)?\s+role|reset\s+role|(?:set|reset)\s+session\s+authorization)\b/i
      .test(sql)
    const defaults = /\balter\s+default\s+privileges\b/i.test(sql)
    const schemaOwner = /\bcreate\s+schema\b[\s\S]*\bauthorization\b/i.test(sql)
    const membership = /\b(?:grant|revoke)\b/i.test(sql) &&
      /\b(?:grant|revoke)\b(?:(?!\bon\b)[\s\S])*\b(?:to|from)\b/i.test(sql)
    if (roleDdl || owned || ownerTransfer || roleSession || membership ||
      defaults || schemaOwner) {
      changes.push("role and ownership authority is not yet modeled")
    }
  }
  return [...new Set(changes)]
}
