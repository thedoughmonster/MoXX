export const STATIC_DATE = Symbol("Date")
export const STATIC_DATE_PARSE = Symbol("Date.parse")
export const STATIC_DATE_UTC = Symbol("Date.UTC")
export const STATIC_GLOBAL_THIS = Symbol("globalThis")

export type TypescriptStaticValue =
  | number
  | string
  | readonly TypescriptStaticValue[]
  | typeof STATIC_DATE
  | typeof STATIC_DATE_PARSE
  | typeof STATIC_DATE_UTC
  | typeof STATIC_GLOBAL_THIS

export type TypescriptStaticScope = Map<string, TypescriptStaticValue | undefined>
