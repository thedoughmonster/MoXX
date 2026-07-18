export function readDollarQuoteTag(
  source: string,
  index: number,
): string | undefined {
  if (source[index] !== "$" ||
    /[a-z0-9_$\u0080-\uffff]/i.test(source[index - 1] ?? "")) return undefined
  return source.slice(index).match(/^\$(?:[a-z_][a-z0-9_]*)?\$/i)?.[0]
}
