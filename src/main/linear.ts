import type { LinearIssue, WorkflowState } from '../shared/types'

const ENDPOINT = 'https://api.linear.app/graphql'

async function gql<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey
    },
    body: JSON.stringify({ query, variables })
  })
  if (!res.ok) throw new Error(`Linear HTTP ${res.status}`)
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  if (!body.data) throw new Error('Empty Linear response')
  return body.data
}

export async function fetchTeamIssues(apiKey: string, teamKey: string): Promise<LinearIssue[]> {
  const issues: LinearIssue[] = []
  let after: string | null = null

  // ponytail: page until done; fine for a personal team
  do {
    const data = await gql<{
      issues: {
        nodes: {
          id: string
          identifier: string
          title: string
          url: string
          state: { name: string; type: string }
          projectMilestone: { name: string } | null
        }[]
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
      }
    }>(
      apiKey,
      `query($teamKey: String!, $after: String) {
        issues(
          first: 50
          after: $after
          filter: { team: { key: { eq: $teamKey } } }
        ) {
          nodes {
            id
            identifier
            title
            url
            state { name type }
            projectMilestone { name }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { teamKey, after }
    )

    for (const n of data.issues.nodes) {
      issues.push({
        id: n.id,
        identifier: n.identifier,
        title: n.title,
        state: n.state.name,
        stateType: n.state.type,
        url: n.url,
        milestone: n.projectMilestone?.name
      })
    }
    after = data.issues.pageInfo.hasNextPage ? data.issues.pageInfo.endCursor : null
  } while (after)

  return issues
}

export async function fetchTeamStates(apiKey: string, teamKey: string): Promise<WorkflowState[]> {
  const data = await gql<{
    teams: { nodes: { states: { nodes: (WorkflowState & { position: number })[] } }[] }
  }>(
    apiKey,
    `query($teamKey: String!) {
      teams(filter: { key: { eq: $teamKey } }) {
        nodes { states { nodes { id name type position } } }
      }
    }`,
    { teamKey }
  )
  const states = data.teams.nodes[0]?.states.nodes ?? []
  return states.sort((a, b) => a.position - b.position).map(({ id, name, type }) => ({ id, name, type }))
}

export async function updateIssueState(
  apiKey: string,
  issueId: string,
  stateId: string
): Promise<{ name: string; type: string }> {
  const data = await gql<{
    issueUpdate: { success: boolean; issue: { state: { name: string; type: string } } }
  }>(
    apiKey,
    `mutation($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
        issue { state { name type } }
      }
    }`,
    { id: issueId, stateId }
  )
  if (!data.issueUpdate.success) throw new Error('Linear rejected the status change')
  return data.issueUpdate.issue.state
}
