import { readDollarQuoteTag } from "./read_dollar_quote_tag.ts"

export type SqlStatement = { index: number; text: string }

export function splitSqlStatements(source: string): SqlStatement[] {
  const statements: SqlStatement[] = []
  let start = 0
  let quote: "'" | '"' | undefined
  let backslashEscapes = false
  let dollarTag: string | undefined
  let lineComment = false
  let blockDepth = 0
  let atomicDepth = 0
  let caseDepth = 0
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (lineComment) {
      if (character === "\n" || character === "\r") lineComment = false
      continue
    }
    if (blockDepth > 0) {
      if (character === "/" && next === "*") {
        blockDepth += 1
        index += 1
      } else if (character === "*" && next === "/") {
        blockDepth -= 1
        index += 1
      }
      continue
    }
    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1
        dollarTag = undefined
      }
      continue
    }
    if (quote) {
      if (backslashEscapes && character === "\\" && next) index += 1
      else if (character === quote && next === quote) index += 1
      else if (character === quote) {
        quote = undefined
        backslashEscapes = false
      }
      continue
    }
    const word = source.slice(index).match(/^[a-z_][a-z0-9_$]*/i)?.[0]
    if (word) {
      const atomic = word.toLowerCase() === "begin"
        ? source.slice(index + word.length).match(/^\s+atomic\b/i)
        : undefined
      if (atomic) {
        atomicDepth += 1
        index += word.length + atomic[0].length - 1
        continue
      }
      if (atomicDepth > 0 && word.toLowerCase() === "case") caseDepth += 1
      else if (atomicDepth > 0 && word.toLowerCase() === "end") {
        if (caseDepth > 0) caseDepth -= 1
        else atomicDepth -= 1
      }
      index += word.length - 1
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      backslashEscapes = character === "'" && /e/i.test(source[index - 1] ?? "") &&
        !/[a-z0-9_$\u0080-\uffff]/i.test(source[index - 2] ?? "")
    }
    else if (character === "$") {
      const tag = readDollarQuoteTag(source, index)
      if (tag) {
        dollarTag = tag
        index += tag.length - 1
      }
    } else if (character === "-" && next === "-") {
      lineComment = true
      index += 1
    } else if (character === "/" && next === "*") {
      blockDepth = 1
      index += 1
    } else if (character === ";" && atomicDepth === 0) {
      const text = source.slice(start, index + 1)
      if (text.trim()) statements.push({ index: start, text })
      start = index + 1
    }
  }
  const text = source.slice(start)
  if (text.trim()) statements.push({ index: start, text })
  return statements
}
