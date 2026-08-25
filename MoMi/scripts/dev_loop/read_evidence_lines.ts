import { closeSync, existsSync, openSync, readSync } from "node:fs"
import { StringDecoder } from "node:string_decoder"
import { stripVTControlCharacters } from "node:util"

import { redactEvidenceLine } from "./redact_evidence_line.ts"
import { scanPrivateKeyMarkers } from "./scan_private_key_markers.ts"

const lineLimit = 16 * 1024
const lineHalf = lineLimit / 2
const redactionLimit = 1024 * 1024
const oversized = "(diagnostic line omitted: exceeded safe redaction bound)"
const unsafeControl = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu

export function* readEvidenceLines(
  inline: string | undefined,
  path: string | undefined,
): Generator<string> {
  const redaction = { private_key: false }
  if (inline) {
    for (const rawLine of inline.split(/[\r\n]+/u)) {
      if (rawLine.length > redactionLimit) {
        scanPrivateKeyMarkers(stripVTControlCharacters(rawLine)
          .replace(unsafeControl, ""), redaction)
        yield oversized
        continue
      }
      const normalized = stripVTControlCharacters(rawLine)
        .replace(unsafeControl, "")
      const line = redactEvidenceLine(normalized, redaction)
      if (line === undefined) continue
      yield line.length <= lineLimit ? line
        : `${line.slice(0, lineHalf)} … ${line.slice(-lineHalf)}`
    }
    return
  }
  if (!path || !existsSync(path)) return
  const descriptor = openSync(path, "r")
  const buffer = Buffer.allocUnsafe(64 * 1024)
  const decoder = new StringDecoder("utf8")
  let pending = ""
  let overflow = false
  let overflowTail = ""
  try {
    let length = readSync(descriptor, buffer, 0, buffer.length, null)
    while (length > 0) {
      const fragments = decoder.write(buffer.subarray(0, length)).split("\n")
      for (const [index, fragment] of fragments.entries()) {
        if (!overflow && pending.length + fragment.length <= redactionLimit) {
          pending += fragment
        } else if (!overflow) {
          const scan = pending + fragment
          scanPrivateKeyMarkers(stripVTControlCharacters(scan)
            .replace(unsafeControl, ""), redaction)
          overflowTail = scan.slice(-128)
          pending = ""
          overflow = true
        } else {
          const scan = overflowTail + fragment
          scanPrivateKeyMarkers(stripVTControlCharacters(scan)
            .replace(unsafeControl, ""), redaction)
          overflowTail = scan.slice(-128)
        }
        if (index < fragments.length - 1) {
          const redacted = overflow ? oversized : redactEvidenceLine(
            stripVTControlCharacters(pending).replace(unsafeControl, ""),
            redaction,
          )
          if (redacted === undefined) {
            pending = ""
            overflow = false
            overflowTail = ""
            continue
          }
          const line = redacted.length <= lineLimit ? redacted
            : `${redacted.slice(0, lineHalf)} … ${redacted.slice(-lineHalf)}`
          yield line.replace(/\r$/u, "")
          pending = ""
          overflow = false
          overflowTail = ""
        }
      }
      length = readSync(descriptor, buffer, 0, buffer.length, null)
    }
    const tail = decoder.end()
    if (!overflow && pending.length + tail.length <= redactionLimit) pending += tail
    else if (tail || overflow) overflow = true
    if (pending || overflow) {
      const redacted = overflow ? oversized : redactEvidenceLine(
        stripVTControlCharacters(pending).replace(unsafeControl, ""),
        redaction,
      )
      if (redacted === undefined) return
      yield redacted.length <= lineLimit ? redacted
        : `${redacted.slice(0, lineHalf)} … ${redacted.slice(-lineHalf)}`
    }
  } finally {
    closeSync(descriptor)
  }
}
