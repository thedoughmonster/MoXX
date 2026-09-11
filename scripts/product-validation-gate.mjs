import { appendFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

export const PRODUCT_VALIDATION_CONTEXT = "product-validation"

function parseSelection(value, product) {
  if (value === "true") return true
  if (value === "false") return false
  throw new Error(`${product} selection is missing or invalid`)
}

function displayedResult(result) {
  return result || "missing"
}

export function evaluateProductValidation({
  routingResult,
  momiSelected,
  momiResult,
  moxiSelected,
  moxiResult,
}) {
  if (routingResult !== "success") {
    return {
      ok: false,
      message: `routing result is ${displayedResult(routingResult)}`,
    }
  }

  let selected
  try {
    selected = [
      ["MoMi", parseSelection(momiSelected, "MoMi"), momiResult],
      ["MoXi", parseSelection(moxiSelected, "MoXi"), moxiResult],
    ]
  } catch (error) {
    return { ok: false, message: error.message }
  }

  const failures = selected
    .filter(([, required, result]) => required && result !== "success")
    .map(([product, , result]) => `${product} result is ${displayedResult(result)}`)

  if (failures.length > 0) {
    return { ok: false, message: failures.join("; ") }
  }

  const requiredProducts = selected
    .filter(([, required]) => required)
    .map(([product]) => product)

  return {
    ok: true,
    message:
      requiredProducts.length > 0
        ? `${requiredProducts.join(" and ")} validation succeeded`
        : "routing selected no product validation",
  }
}

function main() {
  const result = evaluateProductValidation({
    routingResult: process.env.MOXX_ROUTING_RESULT,
    momiSelected: process.env.MOXX_MOMI_SELECTED,
    momiResult: process.env.MOXX_MOMI_RESULT,
    moxiSelected: process.env.MOXX_MOXI_SELECTED,
    moxiResult: process.env.MOXX_MOXI_RESULT,
  })
  const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  const summary = [
    `## ${PRODUCT_VALIDATION_CONTEXT}`,
    "",
    `- Base: \`${process.env.MOXX_BASE_SHA}\``,
    `- Head: \`${process.env.MOXX_HEAD_SHA}\``,
    `- Result: ${result.ok ? "pass" : "fail"} — ${result.message}`,
    `- [Selected validation jobs and logs](${runUrl})`,
    "",
  ].join("\n")
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  }
  process.stdout.write(`${result.message}\n`)
  if (!result.ok) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main()
}
