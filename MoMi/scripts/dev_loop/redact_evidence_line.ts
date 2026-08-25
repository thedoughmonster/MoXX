import { redactValue } from "./redact_value.ts"

export type EvidenceRedactionState = { private_key: boolean }

const pemBegin = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/iu
const pemEnd = /-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/iu

export function redactEvidenceLine(
  line: string,
  state: EvidenceRedactionState,
): string | undefined {
  if (state.private_key) {
    if (pemEnd.test(line)) state.private_key = false
    return undefined
  }
  const begin = pemBegin.exec(line)
  if (!begin || begin.index === undefined) return String(redactValue(line))
  const remainder = line.slice(begin.index + begin[0].length)
  const end = pemEnd.exec(remainder)
  state.private_key = end === null
  const suffix = end && end.index !== undefined
    ? remainder.slice(end.index + end[0].length) : ""
  return String(redactValue(
    `${line.slice(0, begin.index)}[REDACTED PRIVATE KEY]${suffix}`,
  ))
}
