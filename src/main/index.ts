import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { parseDuration } from '../shared/duration'
import { parseEverhourTimeFile } from '../shared/everhour'
import type { AddEntryInput, AppState, Settings, TimeEntry, UpdateEntryInput } from '../shared/types'
import { fetchTeamIssues } from './linear'
import { loadState, saveState } from './store'

app.setName('Time Tracker')

let state: AppState = loadState()

function persist(): AppState {
  saveState(state)
  return state
}

function createWindow(): void {
  nativeTheme.themeSource = 'dark'
  // macOS Dock icon comes from Assets.car + CFBundleIconName (see scripts/brand-electron.mjs)
  // ponytail: height = titlebar (~28) + p-6 + header + tabs + 532px Issues panels
  const win = new BrowserWindow({
    width: 800,
    height: 763,
    minWidth: 800,
    minHeight: 763,
    title: 'Time Tracker',
    backgroundColor: '#1a1d24',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function findTimeFiles(dir: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      // allow picking export root or data/
      if (name === 'data' || name === 'everhour-account-data') files.push(...findTimeFiles(full))
    } else if (/^time_\d{4}_\d{2}\.json$/.test(name)) {
      files.push(full)
    }
  }
  return files
}

app.whenReady().then(() => {
  state = loadState()

  ipcMain.handle('getState', () => state)

  ipcMain.handle('saveSettings', (_e, settings: Settings) => {
    state.settings = {
      linearApiKey: settings.linearApiKey.trim(),
      teamKey: settings.teamKey.trim() || 'SESAM'
    }
    return persist()
  })

  ipcMain.handle('refreshIssues', async () => {
    const { linearApiKey, teamKey } = state.settings
    if (!linearApiKey) throw new Error('Set a Linear API key in Settings first')
    if (!teamKey) throw new Error('Set a team key in Settings first')
    state.issues = await fetchTeamIssues(linearApiKey, teamKey)
    state.issuesUpdatedAt = new Date().toISOString()
    return persist()
  })

  ipcMain.handle('addEntry', (_e, input: AddEntryInput) => {
    const seconds = parseDuration(input.duration)
    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      issueIdentifier: input.issueIdentifier,
      issueTitle: input.issueTitle,
      date: input.date,
      seconds,
      comment: input.comment?.trim() || undefined,
      source: 'manual'
    }
    state.entries = [entry, ...state.entries]
    return persist()
  })

  ipcMain.handle('updateEntry', (_e, input: UpdateEntryInput) => {
    const i = state.entries.findIndex((e) => e.id === input.id)
    if (i < 0) throw new Error('Entry not found')
    const cur = state.entries[i]
    const seconds = input.duration !== undefined ? parseDuration(input.duration) : cur.seconds
    state.entries[i] = {
      ...cur,
      date: input.date ?? cur.date,
      seconds,
      comment: input.comment !== undefined ? input.comment.trim() || undefined : cur.comment
    }
    return persist()
  })

  ipcMain.handle('deleteEntry', (_e, id: string) => {
    state.entries = state.entries.filter((e) => e.id !== id)
    return persist()
  })

  ipcMain.handle('importEverhour', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Everhour export folder',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { state, imported: 0, skipped: 0 }

    const files = findTimeFiles(result.filePaths[0])
    if (!files.length) throw new Error('No time_YYYY_MM.json files found in that folder')

    const seen = new Set(
      state.entries.filter((e) => e.everhourId != null).map((e) => e.everhourId as number)
    )
    let imported = 0
    let skipped = 0
    const fresh: TimeEntry[] = []

    for (const file of files) {
      const rows = parseEverhourTimeFile(readFileSync(file, 'utf8'))
      for (const row of rows) {
        if (row.everhourId != null && seen.has(row.everhourId)) {
          skipped++
          continue
        }
        if (row.everhourId != null) seen.add(row.everhourId)
        fresh.push(row)
        imported++
      }
    }

    state.entries = [...fresh, ...state.entries].sort((a, b) => b.date.localeCompare(a.date))
    return { state: persist(), imported, skipped }
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => app.quit())
