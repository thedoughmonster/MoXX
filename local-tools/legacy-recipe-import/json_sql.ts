import { canonicalJson } from "./canonical_json.ts"
import { sqlLiteral } from "./sql_literal.ts"
import type { JsonValue } from "./types.ts"

export function jsonSql(value: JsonValue): string {
  return `${sqlLiteral(canonicalJson(value))}::jsonb`
}
