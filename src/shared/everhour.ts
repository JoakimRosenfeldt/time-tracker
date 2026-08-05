import type { TimeEntry } from './types'

type EverhourTask = {
  number?: string
  name?: string
}

type EverhourRow = {
  id: number
  date: string
  time: number
  comment?: string
  task?: EverhourTask
}

export function parseEverhourTimeFile(jsonText: string): TimeEntry[] {
  const rows = JSON.parse(jsonText) as EverhourRow[]
  if (!Array.isArray(rows)) throw new Error('Expected an array of time entries')

  const out: TimeEntry[] = []
  for (const row of rows) {
    const identifier = row.task?.number
    if (!identifier || !row.time || !row.date) continue
    out.push({
      id: crypto.randomUUID(),
      issueIdentifier: identifier,
      issueTitle: row.task?.name,
      date: row.date.slice(0, 10),
      seconds: row.time,
      comment: row.comment || undefined,
      source: 'everhour',
      everhourId: row.id
    })
  }
  return out
}
