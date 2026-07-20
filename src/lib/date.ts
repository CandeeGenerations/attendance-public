// All dates handled as UTC to avoid TZ drift; service dates are plain calendar dates.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export {DAY_NAMES}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Sunday (day 0) that starts the week containing `d`.
export function weekStartSunday(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() - x.getUTCDay())
  return x
}

export function currentWeekStart(): string {
  return iso(weekStartSunday(new Date()))
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const x = new Date(Date.UTC(y, m - 1, d))
  x.setUTCDate(x.getUTCDate() + days)
  return iso(x)
}

// Concrete date of a service on `dayOfWeek` within the week starting `weekStart` (a Sunday).
export function resolveServiceDate(weekStart: string, dayOfWeek: number): string {
  return addDays(weekStart, dayOfWeek)
}

// "Sunday 7/19/2026"
export function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  return `Sunday ${m}/${d}/${y}`
}

// "SUNDAY, JUL 19"
export function dayHeading(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DAY_NAMES[wd].toUpperCase()}, ${MONTHS[m - 1].toUpperCase()} ${d}`
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${ampm}`
}
