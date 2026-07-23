export type IssueDisposition = "partial" | "complete"

export type IssueTracking = {
  issueNumber: number
  disposition: IssueDisposition
}
