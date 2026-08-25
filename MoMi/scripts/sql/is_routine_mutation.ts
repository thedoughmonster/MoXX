export function isRoutineMutation(source: string, routine: string): boolean {
  const escaped = routine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return [
    `\\b(?:create(?:\\s+or\\s+replace)?|alter)\\s+` +
      `(?:function|procedure|routine)\\s+(?:if\\s+exists\\s+)?${escaped}\\b`,
    `\\bdrop\\s+(?:function|procedure|routine)\\b[^;]*\\b${escaped}\\b`,
    `\\b(?:comment\\s+on|security\\s+label\\s+on)\\s+` +
      `(?:function|procedure|routine)\\s+${escaped}\\b`,
    `\\b(?:grant|revoke)\\b[^;]*\\bon\\s+` +
      `(?:function|procedure|routine)\\s+[^;]*\\b${escaped}\\b`,
  ].some((pattern) => new RegExp(pattern, "i").test(source))
}
