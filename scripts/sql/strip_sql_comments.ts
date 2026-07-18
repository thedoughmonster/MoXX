import { readDollarQuoteTag } from "./read_dollar_quote_tag.ts"

export function stripSqlComments(source: string): string {
  let result = ""
  let quote: "'" | '"' | undefined
  let backslashEscapes = false
  let dollarTag: string | undefined
  let lineComment = false
  let blockDepth = 0
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (lineComment) {
      if (character === "\n" || character === "\r") {
        lineComment = false
        result += character
      } else result += " "
      continue
    }
    if (blockDepth > 0) {
      if (character === "/" && next === "*") {
        blockDepth += 1
        result += "  "
        index += 1
      } else if (character === "*" && next === "/") {
        blockDepth -= 1
        result += "  "
        index += 1
      } else result += character === "\n" || character === "\r" ? character : " "
      continue
    }
    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        result += dollarTag
        index += dollarTag.length - 1
        dollarTag = undefined
      } else result += character
      continue
    }
    if (quote) {
      result += character
      if (backslashEscapes && character === "\\" && next) {
        result += next
        index += 1
      } else if (character === quote && next === quote) {
        result += next
        index += 1
      } else if (character === quote) {
        quote = undefined
        backslashEscapes = false
      }
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      backslashEscapes = character === "'" && /e/i.test(source[index - 1] ?? "") &&
        !/[a-z0-9_$\u0080-\uffff]/i.test(source[index - 2] ?? "")
      result += character
    } else if (character === "$") {
      const tag = readDollarQuoteTag(source, index)
      if (!tag) result += character
      else {
        dollarTag = tag
        result += tag
        index += tag.length - 1
      }
    } else if (character === "-" && next === "-") {
      lineComment = true
      result += "  "
      index += 1
    } else if (character === "/" && next === "*") {
      blockDepth = 1
      result += "  "
      index += 1
    } else result += character
  }
  return result
}
