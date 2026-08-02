import type { SqlTimestampToken } from "./sql_timestamp_token.ts"
import { decodePostgresEscapeString } from "./decode_postgres_escape_string.ts"

export function tokenizeSqlTimestamps(source: string): SqlTimestampToken[] {
  const tokens: SqlTimestampToken[] = []
  let index = 0
  let line = 1
  let leadingNewline = false
  while (index < source.length) {
    const character = source[index]
    if (/\s/.test(character)) {
      if (character === "\n") { line += 1; leadingNewline = true }
      index += 1
      continue
    }
    if (source.startsWith("--", index)) {
      const end = source.indexOf("\n", index + 2)
      index = end < 0 ? source.length : end
      continue
    }
    if (source.startsWith("/*", index)) {
      let depth = 1
      index += 2
      while (index < source.length && depth > 0) {
        if (source.startsWith("/*", index)) {
          depth += 1
          index += 2
        } else if (source.startsWith("*/", index)) {
          depth -= 1
          index += 2
        } else {
          if (source[index] === "\n") { line += 1; leadingNewline = true }
          index += 1
        }
      }
      continue
    }
    const escapeString = /[Ee]/.test(character) && source[index + 1] === "'"
    const unicodeString = /[Uu]/.test(character) && source[index + 1] === "&" &&
      source[index + 2] === "'"
    if (character === "'" || escapeString || unicodeString) {
      const startLine = line
      let value = ""
      index += escapeString ? 2 : unicodeString ? 3 : 1
      while (index < source.length) {
        if (source[index] === "'" && source[index + 1] === "'") {
          value += "'"
          index += 2
        } else if (escapeString && source[index] === "\\" && index + 1 < source.length) {
          value += source.slice(index, index + 2)
          index += 2
        } else if (source[index] === "'") {
          index += 1
          break
        } else {
          if (source[index] === "\n") line += 1
          value += source[index]
          index += 1
        }
      }
      if (escapeString || unicodeString) {
        value = decodePostgresEscapeString(value, escapeString ? "escape" : "unicode")
      }
      tokens.push({ kind: "string", value, line: startLine, leadingNewline })
      leadingNewline = false
      continue
    }
    const dollar = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0]
    if (dollar) {
      const startLine = line
      const start = index + dollar.length
      const end = source.indexOf(dollar, start)
      const terminal = end < 0 ? source.length : end
      const value = source.slice(start, terminal)
      line += (value.match(/\n/g) ?? []).length
      index = end < 0 ? source.length : end + dollar.length
      tokens.push({ kind: "dollar", value, line: startLine, leadingNewline })
      leadingNewline = false
      continue
    }
    if (character === '"') {
      const startLine = line
      let value = ""
      index += 1
      while (index < source.length) {
        if (source[index] === '"' && source[index + 1] === '"') {
          value += '"'; index += 2
        }
        else if (source[index] === '"') { index += 1; break }
        else { if (source[index] === "\n") line += 1; value += source[index]; index += 1 }
      }
      tokens.push({ kind: "symbol", value: `"${value}"`, line: startLine, leadingNewline })
      leadingNewline = false
      continue
    }
    const number = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)?.[0]
    if (number) {
      tokens.push({ kind: "number", value: number, line, leadingNewline })
      leadingNewline = false
      index += number.length
      continue
    }
    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/)?.[0]
    if (word) {
      tokens.push({ kind: "word", value: word.toLowerCase(), line, leadingNewline })
      leadingNewline = false
      index += word.length
      continue
    }
    tokens.push({ kind: "symbol", value: character, line, leadingNewline })
    leadingNewline = false
    index += 1
  }
  return tokens
}
