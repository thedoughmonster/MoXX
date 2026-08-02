export type SqlTimestampToken = {
  kind: "dollar" | "number" | "string" | "symbol" | "word"
  value: string
  line: number
  leadingNewline: boolean
}
