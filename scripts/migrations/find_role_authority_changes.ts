import { splitSqlStatements } from "../sql/split_sql_statements.ts"

export function findRoleAuthorityChanges(source: string): string[] {
  const changes: string[] = []
  for (const statement of splitSqlStatements(source)) {
    const sql = statement.text.trim()
    const roleDdl = /\b(?:create|alter|drop)\s+(?:role|user|group)\b/i.test(sql)
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
