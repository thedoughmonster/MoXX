const credential: Array<[RegExp, RegExp, string]> = [
  [/gh[pousr]_|github_pat_/i,
    /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    "[REDACTED]"],
  [/eyJ/u,
    /\b(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    "[REDACTED]"],
  [/sk-/u, /\b(?:sk-[A-Za-z0-9_-]{16,})\b/g, "[REDACTED]"],
  [/authorization["']?\s*:\s*"/i,
    /((?:["']?authorization["']?\s*:\s*"(?:bearer|basic)\s+))(?:\\.|[^"\\])*"/gi,
    "$1[REDACTED]\""],
  [/authorization["']?\s*:\s*'/i,
    /((?:["']?authorization["']?\s*:\s*'(?:bearer|basic)\s+))(?:\\.|[^'\\])*'/gi,
    "$1[REDACTED]'"],
  [/authorization\s*:/i,
    /((?:authorization)\s*:\s*(?:bearer|basic)\s+)[^\s,;]+/gi,
    "$1[REDACTED]"],
  [/:\/\//u, /\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^\s/@]+@/gi,
    "$1[REDACTED]@"],
  [/(?:password|token|secret|api[_-]?key|access[_-]?key(?:[_-]?id)?)["']?\s*[=:]\s*"/i,
    /((?:["']?(?:[a-z0-9]+[_-])*(?:password|token|secret|api[_-]?key|access[_-]?key(?:[_-]?id)?)["']?\s*[=:]\s*"))(?:\\.|[^"\\])*"/gi,
    "$1[REDACTED]\""],
  [/(?:password|token|secret|api[_-]?key|access[_-]?key(?:[_-]?id)?)["']?\s*[=:]\s*'/i,
    /((?:["']?(?:[a-z0-9]+[_-])*(?:password|token|secret|api[_-]?key|access[_-]?key(?:[_-]?id)?)["']?\s*[=:]\s*'))(?:\\.|[^'\\])*'/gi,
    "$1[REDACTED]'"],
  [/(?:password|token|secret|api[_-]?key|access[_-]?key(?:[_-]?id)?)["']?\s*[=:]/i,
    /((?:["']?(?:[a-z0-9]+[_-])*(?:password|token|secret|api[_-]?key|access[_-]?key(?:[_-]?id)?)["']?\s*[=:]\s*))[^\s"',;}\]]+/gi,
    "$1[REDACTED]"],
]

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return credential.reduce(
      (source, [hint, pattern, replacement]) => hint.test(source)
        ? source.replace(pattern, replacement) : source,
      value,
    )
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /password|token|secret|api[_-]?key|access[_-]?key/i.test(key)
        ? "[REDACTED]"
        : redactValue(item),
    ]))
  }
  return value
}
