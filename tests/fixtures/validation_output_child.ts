const mode = process.argv[2]
if (mode === "pass") {
  process.stdout.write("Progress: resolved 100\npassing raw detail\n")
  process.exit(0)
}
if (mode === "missing") process.exit(3)
if (mode === "advisory") {
  process.stderr.write("Status: stale\n")
  process.exit(1)
}
if (mode === "long") {
  process.stdout.write(`${"x".repeat(2 * 1024 * 1024)}\ncomplete\n`)
  process.exit(7)
}
process.stderr.write([
  "Progress: resolved 100",
  "✔ earlier passing test (5ms)",
  "src/first.ts:10:2 rule/example: invalid token=fixture-secret",
  "    at deepStack (node:internal/test:1:1)",
  "src/second.ts:20:4 rule/example: invalid token=fixture-secret",
  ...Array.from({ length: 40 }, (_, index) => `    at frame${index} (stack.ts:${index}:1)`),
].join("\n"))
process.exit(2)
