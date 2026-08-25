import {
  parsePullRequestIssueTracking,
} from "./issue_tracking/parse_pull_request_issue_tracking.ts"
import { assertIssueMatchesHeadRef } from "./issue_tracking/assert_issue_matches_head_ref.ts"

const tracking = parsePullRequestIssueTracking(process.env.MOMI_PR_BODY ?? "")
const headRef = process.env.MOXX_HEAD_REF?.trim() ?? ""
if (!headRef) throw new Error("MOXX_HEAD_REF is required")
assertIssueMatchesHeadRef(tracking.issueIdentifier, headRef)
console.log(
  `Owning Linear issue ${tracking.issueIdentifier} matches head branch ${headRef}`,
)
