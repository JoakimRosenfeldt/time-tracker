export type TimeEntry = {
  id: string
  issueIdentifier: string
  issueTitle?: string
  date: string
  seconds: number
  comment?: string
  source: 'manual' | 'everhour'
  everhourId?: number
}

export type LinearIssue = {
  id: string
  identifier: string
  title: string
  state: string
  stateType: string
  url: string
  milestone?: string
}

export type Settings = {
  linearApiKey: string
  teamKey: string
}

export type AppState = {
  settings: Settings
  issues: LinearIssue[]
  entries: TimeEntry[]
  issuesUpdatedAt?: string
}

export type AddEntryInput = {
  issueIdentifier: string
  issueTitle?: string
  date: string
  duration: string
  comment?: string
}

export type UpdateEntryInput = {
  id: string
  date?: string
  duration?: string
  comment?: string
}

export const defaultSettings = (): Settings => ({
  linearApiKey: '',
  teamKey: 'SESAM'
})

export const emptyState = (): AppState => ({
  settings: defaultSettings(),
  issues: [],
  entries: []
})
