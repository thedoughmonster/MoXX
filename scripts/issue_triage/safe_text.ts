export const safeTextPattern =
  `^[A-Za-z0-9][A-Za-z0-9 #.,;:!?()/'"&%+-]*$`

const safeText = new RegExp(safeTextPattern)

export function isSafeText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string" &&
    value.length <= maximumLength && safeText.test(value)
}
