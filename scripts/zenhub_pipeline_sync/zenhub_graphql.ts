const endpoint = "https://api.zenhub.com/public/graphql"

type GraphQLPayload<T> = {
  data?: T
  errors?: Array<{ message: string; path?: Array<string | number> }>
}

export async function zenhubGraphQL<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!response.ok) {
    throw new Error(`Zenhub request failed with HTTP ${response.status}`)
  }
  const payload = await response.json() as GraphQLPayload<T>
  if (payload.errors?.length) {
    throw new Error(
      `Zenhub GraphQL failed: ${payload.errors.map((error) => error.message).join("; ")}`,
    )
  }
  if (!payload.data) throw new Error("Zenhub GraphQL returned no data")
  return payload.data
}
