import { EXECUTABLE_TIMESTAMP_POLICY } from "./executable_timestamp_policy.ts"
import { tokenizeSqlTimestamps } from "./tokenize_sql_timestamps.ts"

export function scanSqlPreopeningTimestamps(
  source: string,
  path: string,
  lineOffset = 0,
): string[] {
  const tokens = tokenizeSqlTimestamps(source)
  const findings = new Set<string>()
  const boundaryDate = EXECUTABLE_TIMESTAMP_POLICY.earliestDate
  const boundaryMs = Date.parse(EXECUTABLE_TIMESTAMP_POLICY.earliestTimestampUtc)
  const types = new Set(["date", "timestamp", "timestamptz"])
  const foldString = (start: number) => {
    let value = tokens[start]?.kind === "string" ? tokens[start].value : ""
    let last = start
    while (tokens[last + 1]?.kind === "string" && tokens[last + 1].leadingNewline) {
      last += 1
      value += tokens[last].value
    }
    return { value, last }
  }
  const inspect = (type: string, value: string, line: number) => {
    const absoluteLine = line + lineOffset
    if (value.toLowerCase() === "epoch") {
      findings.add(`${path}:${absoluteLine}: SQL ${type} epoch predates ${boundaryDate}`)
      return
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      if (value < boundaryDate) {
        findings.add(`${path}:${absoluteLine}: SQL ${type} ${value} predates ${boundaryDate}`)
      }
      return
    }
    if (type === "date") return
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)) return
    const normalized = value.includes("T") ? value : value.replace(" ", "T")
    const parsed = Date.parse(/[Zz]|[+-]\d{2}:?\d{2}$/.test(normalized)
      ? normalized : `${normalized}Z`)
    if (!Number.isFinite(parsed) || parsed < boundaryMs) {
      findings.add(`${path}:${absoluteLine}: SQL ${type} ${value} predates or cannot satisfy ${boundaryDate}`)
    }
  }
  let statementStart = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]
    if (token.value === ";") statementStart = index + 1
    if (token.kind === "dollar") {
      const statement = tokens.slice(statementStart, index)
      const words = statement.filter((part) => part.kind === "word").map((part) => part.value)
      const executable = words[0] === "do" ||
        (words.includes("create") && (words.includes("function") || words.includes("procedure")) &&
          words.at(-1) === "as")
      if (executable) {
        for (const finding of scanSqlPreopeningTimestamps(
          token.value, path, lineOffset + token.line - 1,
        )) findings.add(finding)
      }
      continue
    }
    if (token.kind === "word" && types.has(token.value) && next?.kind === "string") {
      const folded = foldString(index + 1)
      inspect(token.value, folded.value, token.line)
    }
    if (token.value === "timestamp" && ["with", "without"].includes(next?.value) &&
      tokens[index + 2]?.value === "time" && tokens[index + 3]?.value === "zone" &&
      tokens[index + 4]?.kind === "string") {
      const folded = foldString(index + 4)
      inspect(next.value === "with" ? "timestamptz" : "timestamp", folded.value, token.line)
    }
    if (token.kind === "string" && !(tokens[index - 1]?.kind === "string" && token.leadingNewline)) {
      const folded = foldString(index)
      const after = folded.last + 1
      if (tokens[after]?.value === ":" && tokens[after + 1]?.value === ":" &&
        tokens[after + 2]?.kind === "word" && types.has(tokens[after + 2].value)) {
        inspect(tokens[after + 2].value, folded.value, token.line)
      }
    }
    if (token.value === "cast" && next?.value === "(" && tokens[index + 2]?.kind === "string") {
      const folded = foldString(index + 2)
      const after = folded.last + 1
      if (tokens[after]?.value === "as" && tokens[after + 1]?.kind === "word" &&
        types.has(tokens[after + 1].value)) inspect(tokens[after + 1].value, folded.value, token.line)
    }
    if (token.value !== "to_timestamp" || next?.value !== "(") continue
    let cursor = index + 2
    let sign = 1
    if (["+", "-"].includes(tokens[cursor]?.value)) {
      sign = tokens[cursor].value === "-" ? -1 : 1
      cursor += 1
    }
    if (tokens[cursor]?.kind !== "number" || tokens[cursor + 1]?.value !== ")") continue
    const milliseconds = sign * Number(tokens[cursor].value) * 1_000
    if (!Number.isFinite(milliseconds) || milliseconds < boundaryMs) {
      findings.add(`${path}:${token.line + lineOffset}: SQL Unix timestamp predates or overflows ${boundaryDate}`)
    }
  }
  return [...findings].sort()
}
