const API_BASE = (import.meta.env.VITE_CGEN_API_BASE ?? '').replace(/\/$/, '')
const BASE = `${API_BASE}/attendance-public`

// Per-recorder token from the path: /r/<token>
export function getToken(): string {
  const m = window.location.pathname.match(/\/r\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {'Content-Type': 'application/json'},
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
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
