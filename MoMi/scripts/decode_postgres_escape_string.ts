export function decodePostgresEscapeString(
  value: string,
  mode: "escape" | "unicode",
): string {
  let decoded = ""
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\" || index + 1 >= value.length) {
      decoded += value[index]
      continue
    }
    const next = value[index + 1]
    if (mode === "unicode") {
      const width = next === "+" ? 6 : 4
      const start = index + (next === "+" ? 2 : 1)
      const digits = value.slice(start, start + width)
      if (/^[0-9A-Fa-f]+$/.test(digits) && digits.length === width) {
        decoded += String.fromCodePoint(Number.parseInt(digits, 16))
        index = start + width - 1
      } else {
        decoded += next
        index += 1
      }
      continue
    }
    const controls: Record<string, string> = {
      b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
    }
    if (controls[next] !== undefined) {
      decoded += controls[next]
      index += 1
      continue
    }
    const hexPrefix = next === "x" ? 2 : next === "u" ? 4 : next === "U" ? 8 : 0
    if (hexPrefix > 0) {
      const digits = value.slice(index + 2, index + 2 + hexPrefix)
      if (/^[0-9A-Fa-f]+$/.test(digits) && digits.length === hexPrefix) {
        decoded += String.fromCodePoint(Number.parseInt(digits, 16))
        index += 1 + hexPrefix
        continue
      }
    }
    const octal = value.slice(index + 1).match(/^[0-7]{1,3}/)?.[0]
    if (octal) {
      decoded += String.fromCodePoint(Number.parseInt(octal, 8))
      index += octal.length
    } else {
      decoded += next
      index += 1
    }
  }
  return decoded
}
