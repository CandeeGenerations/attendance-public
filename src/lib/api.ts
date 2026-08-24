const API_BASE = (import.meta.env.VITE_CGEN_API_BASE ?? '').replace(/\/$/, '')
const BASE = `${API_BASE}/attendance-public`

// Thrown only when the server actually answered. A bare TypeError from `fetch` means we never
// reached it — the outbox uses that distinction to tell "offline, retry" from "rejected, don't".
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {'Content-Type': 'application/json'},
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error || `Request failed: ${res.status}`, res.status)
  }
  return res.json()
}

export interface ServiceTime {
  id: number
  name: string
  dayOfWeek: number
  time: string
  sortOrder: number
}

export interface Session {
  recorderName: string
  serviceTimes: ServiceTime[]
}

export interface RecordValue {
  serviceTimeId: number
  date: string
  attendance: number | null
  streaming: number | null
}

export interface WeekRecord extends RecordValue {
  /** Server time of the newest edit, or null if nothing has been entered. */
  latestEnteredAt: string | null
}

export interface Week {
  weekStart: string
  records: WeekRecord[]
}

const enc = encodeURIComponent

export const fetchSession = (token: string) => request<Session>(`/${enc(token)}`)

// Every record for a week in one request — the poll that keeps a second device current.
export const fetchWeek = (token: string, weekStart: string) => request<Week>(`/${enc(token)}/week/${enc(weekStart)}`)

// A Correction: typed values that replace both fields.
export const saveCorrection = (
  token: string,
  data: {serviceTimeId: number; date: string; attendance: number | null; streaming: number | null},
) => request<RecordValue & {saved: true}>(`/${enc(token)}/record`, {method: 'POST', body: JSON.stringify(data)})

// A Tally: an adjustment to one field, carrying the moment it was tapped so the server can tell it
// from a count that has since been declared outright (ADR-0027).
export const saveTally = (
  token: string,
  data: {serviceTimeId: number; date: string; field: 'attendance' | 'streaming'; adjustment: number; tappedAt: string},
) =>
  request<RecordValue & {applied: boolean; saved: true}>(`/${enc(token)}/record`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
