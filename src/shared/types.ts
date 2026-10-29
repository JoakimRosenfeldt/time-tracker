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

export type WorkflowState = {
  id: string
  name: string
  type: string
}

export type Settings = {
  linearApiKey: string
  teamKey: string
}

export type AppState = {
  settings: Settings
  issues: LinearIssue[]
  workflowStates: WorkflowState[]
  entries: TimeEntry[]
  issuesUpdatedAt?: string
  /** Last day (inclusive) of each closed salary period, sorted ascending */
  salaryPeriodEnds: string[]
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
  workflowStates: [],
  entries: [],
  salaryPeriodEnds: []
})
