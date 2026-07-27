import { changeZenhubIssueType } from "./change_zenhub_issue_type.ts"
import { getAssignableIssueTypes } from "./get_assignable_issue_types.ts"
import { getGitHubRoadmapIssue } from "./get_github_roadmap_issue.ts"
import { getZenhubRepository } from "./get_zenhub_repository.ts"
import { getZenhubRoadmapIssue } from "./get_zenhub_roadmap_issue.ts"
import { roadmapTitle } from "./roadmap_title.ts"
import { setZenhubIssueParent } from "./set_zenhub_issue_parent.ts"
import type { RoadmapSyncInput } from "./types.ts"
import { updateGitHubRoadmapTitle } from "./update_github_roadmap_title.ts"

export async function syncRoadmap(input: RoadmapSyncInput): Promise<Record<string, number>> {
  const repositoryId = await getZenhubRepository(
    input.zenhubToken,
    input.workspaceId,
    input.githubRepositoryId,
  )
  const issueTypes = await getAssignableIssueTypes(
    input.zenhubToken,
    input.workspaceId,
    repositoryId,
  )
  const requireType = (name: string): string => {
    const matches = issueTypes.filter((issueType) => issueType.name === name)
    if (matches.length !== 1) throw new Error(`Zenhub must expose exactly one ${name} issue type`)
    return matches[0]!.id
  }
  const initiativeTypeId = requireType("Initiative")
  const projectTypeId = requireType("Project")
  const entries = [input.contract.initiative, ...input.contract.projects]
  const current = await Promise.all(entries.map(async (entry) => ({
    entry,
    github: await getGitHubRoadmapIssue(
      input.githubToken,
      input.githubRepository,
      entry.issue_number,
    ),
    zenhub: await getZenhubRoadmapIssue(
      input.zenhubToken,
      input.githubRepositoryId,
      entry.issue_number,
    ),
  })))
  const initiative = current[0]!
  const projects = current.slice(1)
  const titleDrift = current.filter(({ entry, github }) => github.title !== roadmapTitle(entry))
  const initiativeTypeDrift = initiative.zenhub.issueType?.id === initiativeTypeId
    ? []
    : [initiative.zenhub.id]
  const projectTypeDrift = projects
    .filter(({ zenhub }) => zenhub.issueType?.id !== projectTypeId)
    .map(({ zenhub }) => zenhub.id)
  const parentDrift = projects
    .filter(({ zenhub }) => zenhub.parentIssue?.id !== initiative.zenhub.id)
    .map(({ zenhub }) => zenhub.id)

  await Promise.all(titleDrift.map(({ entry }) => updateGitHubRoadmapTitle(
    input.githubToken,
    input.githubRepository,
    entry.issue_number,
    roadmapTitle(entry),
  )))
  await changeZenhubIssueType(input.zenhubToken, initiativeTypeDrift, initiativeTypeId)
  await changeZenhubIssueType(input.zenhubToken, projectTypeDrift, projectTypeId)
  await setZenhubIssueParent(input.zenhubToken, parentDrift, initiative.zenhub.id)

  const verified = await Promise.all(entries.map(async (entry) => ({
    entry,
    github: await getGitHubRoadmapIssue(
      input.githubToken,
      input.githubRepository,
      entry.issue_number,
    ),
    zenhub: await getZenhubRoadmapIssue(
      input.zenhubToken,
      input.githubRepositoryId,
      entry.issue_number,
    ),
  })))
  const failures = verified.filter(({ entry, github, zenhub }, index) =>
    github.title !== roadmapTitle(entry) ||
    zenhub.issueType?.id !== (index === 0 ? initiativeTypeId : projectTypeId) ||
    (index > 0 && zenhub.parentIssue?.id !== initiative.zenhub.id)
  )
  if (failures.length) {
    throw new Error(`Roadmap verification failed for issues ${failures.map(({ entry }) => `#${entry.issue_number}`).join(", ")}`)
  }
  return {
    issues: entries.length,
    parents_repaired: parentDrift.length,
    titles_repaired: titleDrift.length,
    types_repaired: initiativeTypeDrift.length + projectTypeDrift.length,
  }
}
