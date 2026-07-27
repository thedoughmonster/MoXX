import type { RoadmapContract, RoadmapEntry } from "./types.ts"

export function parseRoadmapContract(value: unknown): RoadmapContract {
  const fail = (message: string): never => {
    throw new Error(`Invalid Zenhub roadmap contract: ${message}`)
  }
  const isObject = (candidate: unknown): candidate is Record<string, unknown> =>
    typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)
  const requireKeys = (
    candidate: Record<string, unknown>,
    allowed: readonly string[],
    context: string,
  ): void => {
    const extras = Object.keys(candidate).filter((key) => !allowed.includes(key))
    if (extras.length) fail(`${context} has unknown keys: ${extras.join(", ")}`)
  }
  const parseEntry = (candidate: unknown, context: string): RoadmapEntry => {
    if (!isObject(candidate)) fail(`${context} must be an object`)
    requireKeys(candidate, ["issue_number", "order", "title"], context)
    const issueNumber = candidate.issue_number
    const order = candidate.order
    const title = candidate.title
    if (!Number.isSafeInteger(issueNumber) || Number(issueNumber) < 1) {
      fail(`${context}.issue_number must be a positive integer`)
    }
    if (typeof order !== "string" || !/^[0-9]{2}[A-Z]?$/.test(order)) {
      fail(`${context}.order must be two digits with an optional uppercase letter`)
    }
    if (
      typeof title !== "string" || title.trim() !== title || title.length < 1 ||
      `${order} · ${title}`.length > 256
    ) {
      fail(`${context}.title must be non-blank, trimmed, and fit a GitHub issue title`)
    }
    return { issue_number: Number(issueNumber), order, title }
  }

  if (!isObject(value)) fail("root must be an object")
  requireKeys(value, ["$schema", "schema_version", "initiative", "projects"], "root")
  if (value.$schema !== "./zenhub-roadmap.schema.json") fail("$schema is unsupported")
  if (value.schema_version !== 1) fail("schema_version must equal 1")
  const initiative = parseEntry(value.initiative, "initiative")
  if (initiative.order !== "00") fail("initiative.order must equal 00")
  if (!Array.isArray(value.projects) || value.projects.length < 1 || value.projects.length > 24) {
    fail("projects must contain between 1 and 24 entries")
  }
  const projects = value.projects.map((project, index) => parseEntry(project, `projects[${index}]`))
  if (projects.some((project) => !/^(?:0[1-9]|[1-9][0-9])[A-Z]?$/.test(project.order))) {
    fail("project orders must be 01 through 99 with an optional uppercase letter")
  }
  const entries = [initiative, ...projects]
  const numbers = entries.map((entry) => entry.issue_number)
  const orders = entries.map((entry) => entry.order)
  if (new Set(numbers).size !== numbers.length) fail("issue numbers must be unique")
  if (new Set(orders).size !== orders.length) fail("orders must be unique")
  if (projects.some((project, index) => index > 0 && projects[index - 1]!.order >= project.order)) {
    fail("projects must be listed in ascending order")
  }
  return { schema_version: 1, initiative, projects }
}
