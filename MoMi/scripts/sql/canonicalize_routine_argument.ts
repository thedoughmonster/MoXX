export function canonicalizeRoutineArgument(
  declaration: string,
  file: string,
): string | undefined {
  let value = declaration.trim().replace(/\s+/g, " ")
  const mode = value.match(/^(inout|in|out|variadic)\s+/i)?.[1].toLowerCase()
  if (mode) value = value.slice(mode.length).trim()
  if (mode === "out") return undefined
  value = value.replace(/\s+(?:default|=)\s+[\s\S]*$/i, "").trim()
  const unnamedType = /^(?:[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?(?:\s*\([^)]*\))?|time(?:stamp)?(?:\s*\([^)]*\))?(?:\s+(?:with|without)\s+time\s+zone)?|double\s+precision|character(?:\s+varying)?(?:\s*\([^)]*\))?|bit(?:\s+varying)?(?:\s*\([^)]*\))?)(?:\[\])*$/i
  let type = value
  if (!unnamedType.test(value)) {
    const named = value.match(/^[a-z_][a-z0-9_]*\s+([\s\S]+)$/i)
    if (!named || !unnamedType.test(named[1])) {
      throw new Error(`${file}: unsupported routine argument ${declaration}`)
    }
    type = named[1]
  }
  type = type.toLowerCase().replace(/\s*\.\s*/g, ".")
    .replace(/\s*\[\s*\]/g, "[]").replace(/\s+/g, " ")
  const dimensions = type.match(/(?:\[\])+$/)?.[0] ?? ""
  let base = type.slice(0, type.length - dimensions.length)
    .replace(/\s*\([^)]*\)(?=\s+(?:with|without)\s+time\s+zone$|$)/, "")
  if (base.startsWith("pg_catalog.")) base = base.slice("pg_catalog.".length)
  const aliases = new Map([
    ["bool", "boolean"], ["int", "integer"], ["int2", "smallint"],
    ["int4", "integer"], ["int8", "bigint"], ["float4", "real"],
    ["float8", "double precision"], ["decimal", "numeric"],
    ["varchar", "character varying"], ["bpchar", "character"],
    ["varbit", "bit varying"], ["timestamp", "timestamp without time zone"],
    ["timestamptz", "timestamp with time zone"],
    ["time", "time without time zone"], ["timetz", "time with time zone"],
  ])
  type = `${aliases.get(base) ?? base}${dimensions ? "[]" : ""}`
  return mode === "variadic" ? `variadic ${type}` : type
}
