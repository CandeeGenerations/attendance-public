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

// A wifi handover can leave a request hanging with neither a response nor an error. Without a
// deadline the outbox's single-flight guard stays shut behind that socket and nothing drains until
// the OS finally gives up — long enough to lose a service. Aborting is safe: the entry carries an
// idempotency key, so a request that did land is answered, not re-counted, on the retry.
const TIMEOUT_MS = 12_000

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {'Content-Type': 'application/json'},
    signal: AbortSignal.timeout(TIMEOUT_MS),
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

// `editId` makes a write safe to repeat. Delivery is at-least-once — a dropped response looks
// exactly like a dropped request — so the server records the id and answers a repeat instead of
// applying it twice (ADR-0034). `duplicate` says which of the two happened; either way the values
// coming back are the record as it now stands.
export interface SaveResult extends RecordValue {
  saved: true
  duplicate: boolean
}

// A Correction: typed values that replace both fields.
export const saveCorrection = (
  token: string,
  data: {editId: string; serviceTimeId: number; date: string; attendance: number | null; streaming: number | null},
) => request<SaveResult>(`/${enc(token)}/record`, {method: 'POST', body: JSON.stringify(data)})

// A Tally: an adjustment to one field, carrying the moment it was tapped so the server can tell it
// from a count that has since been declared outright (ADR-0027).
export const saveTally = (
  token: string,
  data: {
    editId: string
    serviceTimeId: number
    date: string
    field: 'attendance' | 'streaming'
    adjustment: number
    tappedAt: string
  },
) =>
  request<SaveResult & {applied: boolean}>(`/${enc(token)}/record`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
