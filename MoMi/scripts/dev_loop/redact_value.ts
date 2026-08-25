const credential = [
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\b(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
  /\b(?:sk-[A-Za-z0-9_-]{16,})\b/g,
  /\b((?:password|token|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
]

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return credential.reduce(
      (source, pattern) => source.replace(pattern, (_match, prefix) =>
        prefix ? `${prefix}[REDACTED]` : "[REDACTED]"
      ),
      value,
    )
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /password|token|secret|api[_-]?key/i.test(key)
        ? "[REDACTED]"
        : redactValue(item),
    ]))
  }
  return value
}
