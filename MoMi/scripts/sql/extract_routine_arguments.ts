import { readDollarQuoteTag } from "./read_dollar_quote_tag.ts"

export function extractRoutineArguments(
  source: string,
  name: string,
  file: string,
): string[] {
  const nameIndex = source.toLowerCase().indexOf(name.toLowerCase())
  const open = source.indexOf("(", nameIndex + name.length)
  if (nameIndex < 0 || open < 0) {
    throw new Error(`${file}: routine ${name} has no argument list`)
  }
  const arguments_: string[] = []
  let start = open + 1
  let depth = 1
  let quote: "'" | '"' | undefined
  let dollarTag: string | undefined
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1
        dollarTag = undefined
      }
      continue
    }
    if (quote) {
      if (character === quote && next === quote) index += 1
      else if (character === quote) quote = undefined
      continue
    }
    if (character === "'" || character === '"') quote = character
    else if (character === "$") {
      const tag = readDollarQuoteTag(source, index)
      if (tag) {
        dollarTag = tag
        index += tag.length - 1
      }
    } else if (character === "(") depth += 1
    else if (character === ")") {
      depth -= 1
      if (depth === 0) {
        const tail = source.slice(start, index).trim()
        if (tail) arguments_.push(tail)
        return arguments_
      }
    } else if (character === "," && depth === 1) {
      arguments_.push(source.slice(start, index).trim())
      start = index + 1
    }
  }
  throw new Error(`${file}: routine ${name} has an unterminated argument list`)
}
