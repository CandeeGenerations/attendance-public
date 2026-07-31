import {ApiError, type RecordValue, saveRecord} from '@/lib/api'

// Durable write-behind queue for attendance counts.
//
// Every tally tap writes to localStorage *first* and posts to the server afterwards, so a count
// survives a dead cell signal, a backgrounded tab, a crash, or a reload. The UI reads pending
// entries in preference to server data, which means an offline usher sees exactly the number they
// counted. Entries drain automatically when the network returns.
//
// An entry is a full snapshot of both fields (that's the shape the save endpoint takes), so the
// newest queued write for a record always wins — no merge logic, no partial state.

export interface PendingRecord {
  token: string
  serviceTimeId: number
  date: string
  attendance: number | null
  streaming: number | null
  updatedAt: number
}

export interface OutboxState {
  pending: Record<string, PendingRecord>
  /** A flush is in flight right now. */
  syncing: boolean
  /** Reason the last flush stopped, or null if the queue drained cleanly. */
  error: string | null
}

const STORAGE_KEY = 'attendance:outbox:v1'
const DEBOUNCE_MS = 600
const RETRY_BASE_MS = 5_000
const RETRY_MAX_MS = 60_000

export const recordKey = (token: string, serviceTimeId: number, date: string) => `${token}|${serviceTimeId}|${date}`

function readStored(): Record<string, PendingRecord> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, PendingRecord>) : {}
  } catch {
    return {}
  }
}

function persist(pending: Record<string, PendingRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    /* quota or private mode — the in-memory queue still holds the count for this session */
  }
}

let state: OutboxState = {pending: readStored(), syncing: false, error: null}
const listeners = new Set<() => void>()

function emit(next: Partial<OutboxState>): void {
  state = {...state, ...next}
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Identity is stable between mutations, which is what useSyncExternalStore requires.
export const getSnapshot = (): OutboxState => state

export function selectPending(
  snapshot: OutboxState,
  token: string,
  serviceTimeId: number,
  date: string,
): PendingRecord | undefined {
  return snapshot.pending[recordKey(token, serviceTimeId, date)]
}

export const pendingCount = (snapshot: OutboxState): number => Object.keys(snapshot.pending).length

/** Called after each entry lands on the server, so the caller can refresh its own caches. */
let onSynced: ((record: PendingRecord) => void) | null = null
export function setSyncedHandler(handler: ((record: PendingRecord) => void) | null): void {
  onSynced = handler
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let failureStreak = 0

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}

function scheduleRetry(): void {
  if (retryTimer) return
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(failureStreak, 4))
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flush()
  }, delay)
}

function scheduleFlush(delay = DEBOUNCE_MS): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flush()
  }, delay)
}

/** Queue a count. Synchronously durable before this returns. */
export function queueRecord(record: Omit<PendingRecord, 'updatedAt'>): void {
  const key = recordKey(record.token, record.serviceTimeId, record.date)
  const pending = {...state.pending}

  if (record.attendance === null && record.streaming === null) {
    // The server rejects an all-empty record, so there is nothing to send. Drop any queued edit
    // rather than leaving an entry that can never drain and would pin the "pending" badge on.
    if (!(key in pending)) return
    delete pending[key]
    persist(pending)
    emit({pending})
    return
  }

  pending[key] = {...record, updatedAt: Date.now()}
  persist(pending)
  emit({pending, error: null})
  scheduleFlush()
}

function drop(key: string, flushedAt: number): void {
  // Only retire the entry if it wasn't re-tapped while the request was in flight.
  const current = state.pending[key]
  if (!current || current.updatedAt !== flushedAt) return
  const pending = {...state.pending}
  delete pending[key]
  persist(pending)
  emit({pending})
}

export async function flush(): Promise<void> {
  if (flushing) return
  const entries = Object.entries(state.pending)
  if (entries.length === 0) return
  if (!navigator.onLine) {
    scheduleRetry()
    return
  }

  flushing = true
  emit({syncing: true})
  let failure: string | null = null

  for (const [key, record] of entries) {
    try {
      await saveRecord(record.token, {
        serviceTimeId: record.serviceTimeId,
        date: record.date,
        attendance: record.attendance,
        streaming: record.streaming,
      })
      drop(key, record.updatedAt)
      onSynced?.(record)
    } catch (error) {
      failure = error instanceof Error ? error.message : 'Could not sync'
      // No response at all, or a sick server: the network is the problem, so stop hammering it
      // and retry the whole queue on a backoff. A 4xx is specific to this entry — leave it
      // queued (never silently drop a count) but keep draining the rest.
      if (!(error instanceof ApiError) || error.status >= 500) break
    }
  }

  flushing = false
  failureStreak = failure ? failureStreak + 1 : 0
  emit({syncing: false, error: failure})
  if (pendingCount(state) > 0) scheduleRetry()
}

/** Wire up the background drain. Returns a teardown for StrictMode double-mounts. */
export function startOutbox(): () => void {
  const onOnline = () => {
    failureStreak = 0
    clearRetry()
    void flush()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void flush()
  }
  // Another tab (or another recorder link) queued something — mirror it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) emit({pending: readStored()})
  }

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('storage', onStorage)
  void flush()

  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('storage', onStorage)
    if (debounceTimer) clearTimeout(debounceTimer)
    clearRetry()
  }
}

/** Server truth for a record, with any queued local edit layered on top. */
export function resolveRecord(
  snapshot: OutboxState,
  token: string,
  serviceTimeId: number,
  date: string,
  server: RecordValue | undefined,
): {attendance: number | null; streaming: number | null; pending: boolean} {
  const queued = selectPending(snapshot, token, serviceTimeId, date)
  if (queued) return {attendance: queued.attendance, streaming: queued.streaming, pending: true}
  return {attendance: server?.attendance ?? null, streaming: server?.streaming ?? null, pending: false}
}
