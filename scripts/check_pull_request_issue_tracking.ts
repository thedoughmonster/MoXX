import { parsePullRequestIssueTracking } from "./issue_tracking/parse_pull_request_issue_tracking.ts"

const tracking = parsePullRequestIssueTracking(process.env.MOMI_PR_BODY ?? "")
const repository = process.env.GITHUB_REPOSITORY ?? ""
const token = process.env.GH_TOKEN ?? ""
if (!/^[^/]+\/[^/]+$/.test(repository)) {
  throw new Error("GITHUB_REPOSITORY is missing or invalid")
}
if (!token) throw new Error("GH_TOKEN is required to verify the owning issue")

const response = await fetch(
  `https://api.github.com/repos/${repository}/issues/${tracking.issueNumber}`,
  {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  },
)
if (!response.ok) {
  throw new Error(
    `Owning issue #${tracking.issueNumber} lookup failed (${response.status})`,
  )
}
const issue = await response.json() as {
  state?: string
  pull_request?: unknown
}
if (issue.pull_request) {
  throw new Error(`#${tracking.issueNumber} is a pull request, not an issue`)
}
if (issue.state !== "open") {
  throw new Error(`Owning issue #${tracking.issueNumber} must be open`)
}
console.log(
  `Owning issue #${tracking.issueNumber} is open; ` +
  `merge disposition is ${tracking.disposition}`,
)
