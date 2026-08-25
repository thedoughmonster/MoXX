export function readOption(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) {
    return fallback
  }
  const value = process.argv[index + 1]
  if (!value || value.startsWith("--")) {
    throw new Error(`--${name} requires a value`)
  }
  return value
}
