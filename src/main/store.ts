import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { emptyState, type AppState } from '../shared/types'

function storePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'data.json')
}

export function loadState(): AppState {
  const path = storePath()
  if (!existsSync(path)) return emptyState()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as AppState
    return {
      ...emptyState(),
      ...raw,
      settings: { ...emptyState().settings, ...raw.settings },
      issues: raw.issues ?? [],
      entries: raw.entries ?? []
    }
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  writeFileSync(storePath(), JSON.stringify(state, null, 2), 'utf8')
}
