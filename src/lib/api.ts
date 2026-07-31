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

const enc = encodeURIComponent

export const fetchSession = (token: string) => request<Session>(`/${enc(token)}`)

export const fetchRecord = (token: string, serviceTimeId: number, date: string) =>
  request<RecordValue>(`/${enc(token)}/record/${serviceTimeId}/${date}`)

export const saveRecord = (
  token: string,
  data: {serviceTimeId: number; date: string; attendance: number | null; streaming: number | null},
) => request<RecordValue & {saved: true}>(`/${enc(token)}/record`, {method: 'POST', body: JSON.stringify(data)})
