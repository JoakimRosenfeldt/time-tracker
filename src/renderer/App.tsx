import { useEffect, useMemo, useState, type JSX } from 'react'
import { formatDuration } from '@shared/duration'
import type { AppState, LinearIssue, TimeEntry } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfWeek(): string {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // Monday=0
  d.setDate(d.getDate() - day)
  return isoDate(d)
}

function startOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  return isoDate(d)
}

function nextDay(date: string): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + 1)
  return isoDate(d)
}

function currentPeriodStart(ends: string[]): string {
  const last = ends[ends.length - 1]
  return last ? nextDay(last) : startOfMonth()
}

function totalsByIssue(entries: TimeEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries) map.set(e.issueIdentifier, (map.get(e.issueIdentifier) ?? 0) + e.seconds)
  return map
}

export default function App(): JSX.Element {
  const [state, setState] = useState<AppState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [duration, setDuration] = useState('1h')
  const [date, setDate] = useState(today())
  const [comment, setComment] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [teamKey, setTeamKey] = useState('SESAM')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDuration, setEditDuration] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editComment, setEditComment] = useState('')
  const [periodFrom, setPeriodFrom] = useState(startOfWeek)
  const [periodTo, setPeriodTo] = useState(today)
  const [periodEnd, setPeriodEnd] = useState(today)

  useEffect(() => {
    void window.api.getState().then((s) => {
      setApiKey(s.settings.linearApiKey)
      setTeamKey(s.settings.teamKey)
      setPeriodFrom(currentPeriodStart(s.salaryPeriodEnds))
      setState(s)
    })
    // main process re-syncs Linear on startup and every few minutes
    return window.api.onStateChanged(setState)
  }, [])

  const totals = useMemo(() => totalsByIssue(state?.entries ?? []), [state?.entries])

  const issues = useMemo(() => {
    const list = state?.issues ?? []
    const q = query.trim().toLowerCase()
    return list
      .filter((i) => (showCompleted ? true : !['completed', 'canceled'].includes(i.stateType)))
      .filter(
        (i) =>
          !q ||
          i.identifier.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.state.toLowerCase().includes(q) ||
          (i.milestone?.toLowerCase().includes(q) ?? false)
      )
      .sort((a, b) => (totals.get(b.identifier) ?? 0) - (totals.get(a.identifier) ?? 0) || a.identifier.localeCompare(b.identifier))
  }, [state?.issues, query, showCompleted, totals])

  // orphan identifiers from entries not in Linear cache
  const orphanIssues = useMemo(() => {
    if (!state) return [] as LinearIssue[]
    const known = new Set(state.issues.map((i) => i.identifier))
    const map = new Map<string, string | undefined>()
    for (const e of state.entries) {
      if (!known.has(e.issueIdentifier)) map.set(e.issueIdentifier, e.issueTitle)
    }
    return [...map.entries()].map(([identifier, title]) => ({
      id: identifier,
      identifier,
      title: title ?? '(imported / unknown)',
      state: 'Imported',
      stateType: 'unstarted',
      url: ''
    }))
  }, [state])

  const issueById = useMemo(() => {
    const map = new Map<string, LinearIssue>()
    for (const i of state?.issues ?? []) map.set(i.identifier, i)
    return map
  }, [state?.issues])

  const selected =
    issues.find((i) => i.identifier === selectedId) ??
    orphanIssues.find((i) => i.identifier === selectedId) ??
    null

  const issueEntries = useMemo(() => {
    if (!selected || !state) return []
    return state.entries.filter((e) => e.issueIdentifier === selected.identifier)
  }, [selected, state])

  const periodEntries = useMemo(() => {
    if (!state) return [] as TimeEntry[]
    return state.entries.filter((e) => e.date >= periodFrom && e.date <= periodTo)
  }, [state, periodFrom, periodTo])

  const periodTotal = useMemo(
    () => periodEntries.reduce((sum, e) => sum + e.seconds, 0),
    [periodEntries]
  )

  // ponytail: make Everhour inclusion visible; both sources already feed periodTotal
  const periodBySource = useMemo(() => {
    let manual = 0
    let everhour = 0
    for (const e of periodEntries) {
      if (e.source === 'everhour') everhour += e.seconds
      else manual += e.seconds
    }
    return { manual, everhour }
  }, [periodEntries])

  const milestoneTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of periodEntries) {
      const name = issueById.get(e.issueIdentifier)?.milestone ?? 'No milestone'
      map.set(name, (map.get(name) ?? 0) + e.seconds)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [periodEntries, issueById])

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return undefined
    } finally {
      setBusy(false)
    }
  }

  if (!state) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time Tracker</h1>
          <p className="text-sm text-muted-foreground">Manual time on Linear issues · local only</p>
        </div>
        {state.issuesUpdatedAt && (
          <p className="text-xs text-muted-foreground">
            Issues synced {new Date(state.issuesUpdatedAt).toLocaleString()}
          </p>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="totals">Totals</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="flex min-h-[520px] flex-col gap-3 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search issues…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="max-w-xs"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={showCompleted}
                  onCheckedChange={(v) => setShowCompleted(v === true)}
                />
                Show completed
              </label>
            </div>
            {!state.issues.length && (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                Linear issues not synced yet — go to Settings and click <span className="text-foreground">Refresh issues</span> to load states and milestones.
              </p>
            )}
            <ScrollArea className="h-[460px] rounded-md border">
              <ul className="divide-y">
                {[...issues, ...orphanIssues.filter((o) => !issues.some((i) => i.identifier === o.identifier))].map(
                  (issue) => {
                    const total = totals.get(issue.identifier) ?? 0
                    const active = selected?.identifier === issue.identifier
                    return (
                      <li key={issue.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(issue.identifier)}
                          className={cn(
                            'flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent/60',
                            active && 'bg-accent'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{issue.identifier}</span>
                              <Badge variant="secondary">{issue.state}</Badge>
                              {issue.milestone && <Badge variant="outline">{issue.milestone}</Badge>}
                            </div>
                            <p className="truncate text-sm text-muted-foreground">{issue.title}</p>
                          </div>
                          <span className="shrink-0 text-sm tabular-nums">{formatDuration(total)}</span>
                        </button>
                      </li>
                    )
                  }
                )}
                {!issues.length && !orphanIssues.length && (
                  <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No issues yet. Add an API key in Settings and refresh.
                  </li>
                )}
              </ul>
            </ScrollArea>
          </section>

          <section className="flex min-h-[520px] flex-col gap-4 rounded-lg border bg-card p-4">
            {!selected ? (
              <p className="m-auto text-sm text-muted-foreground">Select an issue to log time</p>
            ) : (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{selected.identifier}</h2>
                    {state.workflowStates.length && selected.url ? (
                      <select
                        aria-label="Status"
                        className="h-7 rounded-md border bg-background px-2 text-sm"
                        disabled={busy}
                        value={state.workflowStates.find((s) => s.name === selected.state)?.id ?? ''}
                        onChange={(e) => {
                          const stateId = e.target.value
                          void run(async () => setState(await window.api.setIssueState(selected.id, stateId)))
                        }}
                      >
                        {state.workflowStates.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="outline">{selected.state}</Badge>
                    )}
                    {selected.milestone && <Badge variant="secondary">{selected.milestone}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{selected.title}</p>
                  <p className="mt-1 text-sm">
                    Total: <span className="font-medium">{formatDuration(totals.get(selected.identifier) ?? 0)}</span>
                  </p>
                </div>

                <Separator />

                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(async () => {
                      const next = await window.api.addEntry({
                        issueIdentifier: selected.identifier,
                        issueTitle: selected.title,
                        date,
                        duration,
                        comment
                      })
                      setState(next)
                      setComment('')
                    })
                  }}
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="duration">Time</Label>
                    <Input
                      id="duration"
                      placeholder="1h 30m"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="comment">Comment</Label>
                    <Input
                      id="comment"
                      placeholder="Optional"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={busy}>
                      Add time
                    </Button>
                  </div>
                </form>

                <Separator />

                <ScrollArea className="h-[220px]">
                  <ul className="space-y-2">
                    {issueEntries.map((entry) => (
                      <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                        <div className="text-sm">
                          <div className="font-medium tabular-nums">
                            {formatDuration(entry.seconds)} · {entry.date}
                          </div>
                          <div className="text-muted-foreground">
                            {entry.source}
                            {entry.comment ? ` · ${entry.comment}` : ''}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              setState(await window.api.deleteEntry(entry.id))
                            })
                          }
                        >
                          Delete
                        </Button>
                      </li>
                    ))}
                    {!issueEntries.length && (
                      <li className="py-6 text-center text-sm text-muted-foreground">No entries for this issue</li>
                    )}
                  </ul>
                </ScrollArea>
              </>
            )}
          </section>
        </TabsContent>

        <TabsContent value="entries">
          <section className="rounded-lg border bg-card p-4">
            <ScrollArea className="h-[560px]">
              <ul className="divide-y">
                {[...state.entries]
                  .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
                  .map((entry) => {
                    const milestone = issueById.get(entry.issueIdentifier)?.milestone
                    return (
                    <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      {editId === entry.id ? (
                        <form
                          className="grid w-full gap-2 sm:grid-cols-4"
                          onSubmit={(e) => {
                            e.preventDefault()
                            void run(async () => {
                              setState(
                                await window.api.updateEntry({
                                  id: entry.id,
                                  date: editDate,
                                  duration: editDuration,
                                  comment: editComment
                                })
                              )
                              setEditId(null)
                            })
                          }}
                        >
                          <Input value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
                          <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                          <Input
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            placeholder="Comment"
                          />
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={busy}>
                              Save
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setEditId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div>
                            <div className="font-medium">
                              {entry.issueIdentifier}{' '}
                              <span className="font-normal text-muted-foreground">{entry.issueTitle}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {milestone ? `${milestone} · ` : ''}
                              {entry.date} · {formatDuration(entry.seconds)} · {entry.source}
                              {entry.comment ? ` · ${entry.comment}` : ''}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditId(entry.id)
                                setEditDuration(formatDuration(entry.seconds))
                                setEditDate(entry.date)
                                setEditComment(entry.comment ?? '')
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  setState(await window.api.deleteEntry(entry.id))
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </li>
                    )
                  })}
                {!state.entries.length && (
                  <li className="py-10 text-center text-sm text-muted-foreground">No time entries yet</li>
                )}
              </ul>
            </ScrollArea>
          </section>
        </TabsContent>

        <TabsContent value="totals">
          <section className="space-y-4 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="periodFrom">From</Label>
                <Input
                  id="periodFrom"
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="periodTo">To</Label>
                <Input
                  id="periodTo"
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPeriodFrom(currentPeriodStart(state.salaryPeriodEnds))
                    setPeriodTo(today())
                  }}
                >
                  Salary period
                </Button>
                {state.salaryPeriodEnds.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const ends = state.salaryPeriodEnds
                      const dates = state.entries.map((e) => e.date).sort()
                      setPeriodFrom(ends.length > 1 ? nextDay(ends[ends.length - 2]) : (dates[0] ?? startOfMonth()))
                      setPeriodTo(ends[ends.length - 1])
                    }}
                  >
                    Previous period
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPeriodFrom(startOfWeek())
                    setPeriodTo(today())
                  }}
                >
                  This week
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPeriodFrom(startOfMonth())
                    setPeriodTo(today())
                  }}
                >
                  This month
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const dates = state.entries.map((e) => e.date).sort()
                    setPeriodFrom(dates[0] ?? today())
                    setPeriodTo(dates[dates.length - 1] ?? today())
                  }}
                >
                  All time
                </Button>
              </div>
            </div>

            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void run(async () => {
                  const next = await window.api.setSalaryPeriodEnds([...state.salaryPeriodEnds, periodEnd])
                  setState(next)
                  setPeriodFrom(currentPeriodStart(next.salaryPeriodEnds))
                  setPeriodTo(today())
                })
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="periodEnd">Salary period ends on</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="sm" disabled={busy}>
                End salary period
              </Button>
              {state.salaryPeriodEnds.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const next = await window.api.setSalaryPeriodEnds(state.salaryPeriodEnds.slice(0, -1))
                      setState(next)
                      setPeriodFrom(currentPeriodStart(next.salaryPeriodEnds))
                      setPeriodTo(today())
                    })
                  }
                >
                  Undo last ({state.salaryPeriodEnds[state.salaryPeriodEnds.length - 1]})
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Current period started {currentPeriodStart(state.salaryPeriodEnds)}
              </p>
            </form>

            <div className="flex items-baseline justify-between gap-4 border-b pb-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  {periodFrom} → {periodTo} · {periodEntries.length} entries
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Manual {formatDuration(periodBySource.manual)} · Everhour{' '}
                  {formatDuration(periodBySource.everhour)}
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{formatDuration(periodTotal)}</p>
            </div>

            <ScrollArea className="h-[420px]">
              <ul className="divide-y">
                {milestoneTotals.map(([name, seconds]) => (
                  <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate font-medium">{name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatDuration(seconds)}
                    </span>
                  </li>
                ))}
                {!milestoneTotals.length && (
                  <li className="py-10 text-center text-sm text-muted-foreground">
                    No time in this period
                  </li>
                )}
              </ul>
            </ScrollArea>
          </section>
        </TabsContent>

        <TabsContent value="settings">
          <section className="max-w-xl space-y-5 rounded-lg border bg-card p-4">
            <div className="grid gap-1.5">
              <Label htmlFor="apiKey">Linear API key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="lin_api_…"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Create one in Linear → Settings → Security & access. Stored only on this machine.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="teamKey">Team key</Label>
              <Input id="teamKey" value={teamKey} onChange={(e) => setTeamKey(e.target.value)} placeholder="SESAM" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const next = await window.api.saveSettings({ linearApiKey: apiKey, teamKey })
                    setState(next)
                  })
                }
              >
                Save settings
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await window.api.saveSettings({ linearApiKey: apiKey, teamKey })
                    setState(await window.api.refreshIssues())
                  })
                }
              >
                Refresh issues
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await window.api.importEverhour()
                    setState(result.state)
                    setImportMsg(`Imported ${result.imported}, skipped ${result.skipped} duplicates`)
                  })
                }
              >
                Import Everhour…
              </Button>
            </div>
            {importMsg && <p className="text-sm text-muted-foreground">{importMsg}</p>}
            <p className="text-xs text-muted-foreground">
              Import picks an Everhour account-export folder and reads <code>time_YYYY_MM.json</code> files.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
