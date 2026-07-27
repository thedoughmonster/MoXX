import { zenhubGraphQL } from "../zenhub_pipeline_sync/zenhub_graphql.ts"

type RepositoryData = {
  workspace: null | {
    repositoriesConnection: { nodes: Array<{ ghId: number; id: string; name: string }> }
  }
}

export async function getZenhubRepository(
  token: string,
  workspaceId: string,
  repositoryGhId: number,
): Promise<string> {
  const data = await zenhubGraphQL<RepositoryData>(
    token,
    `query RoadmapRepository($workspaceId: ID!) {
      workspace(id: $workspaceId) {
        repositoriesConnection(first: 100) { nodes { ghId id name } }
      }
    }`,
    { workspaceId },
  )
  if (!data.workspace) throw new Error(`Zenhub workspace ${workspaceId} was not found`)
  const matches = data.workspace.repositoriesConnection.nodes.filter(
    (repository) => repository.ghId === repositoryGhId,
  )
  if (matches.length !== 1) {
    throw new Error(`Zenhub workspace must contain GitHub repository ${repositoryGhId} exactly once`)
  }
  return matches[0]!.id
}
