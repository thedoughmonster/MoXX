import { stripVTControlCharacters } from "node:util"

import { redactValue } from "../dev_loop/redact_value.ts"

const lineBreak = /\r\n|[\r\n\u2028\u2029]/gu
const unsafeControl = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu
const invisible = /\p{Default_Ignorable_Code_Point}/gu

export function sanitizeDiagnosticText(value: string): string {
  const stripped = stripVTControlCharacters(value).replace(invisible, "")
  const normalized = stripped
    .replace(lineBreak, "\\n")
    .replaceAll("\t", "\\t")
    .replace(unsafeControl, "")
  const redacted = String(redactValue(normalized))
  const compacted = stripped.replace(lineBreak, "").replaceAll("\t", "")
    .replace(unsafeControl, "")
  const compactedRedacted = String(redactValue(compacted))
  return redacted === normalized && compactedRedacted !== compacted
    ? "[REDACTED]" : redacted
}
