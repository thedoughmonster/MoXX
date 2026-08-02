import { PROVIDER_STDERR_CODES,
  type ProviderStderrCode } from "./provider_stderr_codes.ts"

export function classifyProviderStderr(stderr: Uint8Array): ProviderStderrCode | undefined {
  if (!(stderr instanceof Uint8Array) || stderr.byteLength > 64 * 1024) return undefined
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(stderr)
  } catch {
    return undefined
  }
  const found = PROVIDER_STDERR_CODES.filter((code) => [
    new RegExp(`^ERROR:\\s+${code}\\s*$`, "m"),
    new RegExp(`"message"\\s*:\\s*"${code}"`),
    new RegExp(`^\\s*message:\\s*${code}\\s*$`, "m"),
  ].some((pattern) => pattern.test(text)))
  return found.length === 1 ? found[0] : undefined
}
