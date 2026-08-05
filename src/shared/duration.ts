/** Parse "1h", "30m", "1h 30m", "1.5h" → seconds. */
export function parseDuration(input: string): number {
  const s = input.trim().toLowerCase()
  if (!s) throw new Error('Duration is required')

  let total = 0
  let matched = false

  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*([hm])/g)) {
    matched = true
    const n = Number(m[1])
    if (m[2] === 'h') total += Math.round(n * 3600)
    else total += Math.round(n * 60)
  }

  if (!matched) throw new Error('Use formats like 1h, 30m, or 1h 30m')
  if (total <= 0) throw new Error('Duration must be positive')
  return total
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}
