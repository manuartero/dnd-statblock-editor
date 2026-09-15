/** "just now", "3 minutes ago", "2 days ago"… for an ISO timestamp. */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return plural(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return plural(hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 30) return plural(days, 'day')
  const months = Math.round(days / 30)
  if (months < 12) return plural(months, 'month')
  return plural(Math.round(days / 365), 'year')
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`
