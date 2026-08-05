import { contextBridge, ipcRenderer } from 'electron'
import type { AddEntryInput, AppState, Settings, UpdateEntryInput } from '../shared/types'

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('getState'),
  saveSettings: (settings: Settings): Promise<AppState> => ipcRenderer.invoke('saveSettings', settings),
  refreshIssues: (): Promise<AppState> => ipcRenderer.invoke('refreshIssues'),
  addEntry: (input: AddEntryInput): Promise<AppState> => ipcRenderer.invoke('addEntry', input),
  updateEntry: (input: UpdateEntryInput): Promise<AppState> => ipcRenderer.invoke('updateEntry', input),
  deleteEntry: (id: string): Promise<AppState> => ipcRenderer.invoke('deleteEntry', id),
  importEverhour: (): Promise<{ state: AppState; imported: number; skipped: number }> =>
    ipcRenderer.invoke('importEverhour')
}

contextBridge.exposeInMainWorld('api', api)

export type TimeTrackerApi = typeof api
