import {ApiError, type RecordValue, saveCorrection, saveTally} from '@/lib/api'

// Durable write-behind queue for attendance counts.
//
// Every entry writes to localStorage *first* and posts to the server afterwards, so a count
// survives a dead cell signal, a backgrounded tab, a crash, or a reload. Entries drain
// automatically when the network returns.
//
// Two kinds of entry, and the difference is the whole design (ADR-0027). A **Tally** is the ±1 of
// a tally key: it carries an adjustment, so a phone that was offline while a laptop counted adds
// to that count instead of overwriting it. A **Correction** is a typed number: it replaces both
// fields outright, because typing a number is a statement about the true count.

export type Field = 'attendance' | 'streaming'

/** Accumulated taps on one field. Split into buckets so a Correction can supersede stale ones. */
export interface TallyBucket {
  field: Field
  adjustment: number
  /** Tap that opened the bucket — what the server compares against the latest Correction. */
  firstTappedAt: number
}

export interface PendingRecord {
  token: string
  serviceTimeId: number
  date: string
  /** Typed values waiting to be sent. Applied before this record's tallies. */
  correction: {attendance: number | null; streaming: number | null} | null
  tallies: TallyBucket[]
  updatedAt: number
}

export interface OutboxState {
  pending: Record<string, PendingRecord>
  /** A flush is in flight right now. */
  syncing: boolean
  /** Reason the last flush stopped, or null if the queue drained cleanly. */
  error: string | null
}

const STORAGE_KEY = 'attendance:outbox:v2'
const LEGACY_STORAGE_KEY = 'attendance:outbox:v1'
const DEBOUNCE_MS = 600
const RETRY_BASE_MS = 5_000
const RETRY_MAX_MS = 60_000
// Taps keep landing in the same bucket for this long. A bucket is discarded whole if a Correction
// was made after it opened, so a wide window would throw away taps made after that Correction —
// and a narrow one costs a request per bucket when a long offline queue drains.
const BUCKET_MS = 60_000

export const recordKey = (token: string, serviceTimeId: number, date: string) => `${token}|${serviceTimeId}|${date}`

function readStored(): Record<string, PendingRecord> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (parsed && typeof parsed === 'object') return parsed as Record<string, PendingRecord>
  } catch {
    /* unreadable — fall through to the legacy queue */
  }
  return readLegacy()
}

// v1 queued whole snapshots, which is what a Correction is. An entry stranded there by an upgrade
// mid-service still has to reach the server.
function readLegacy(): Record<string, PendingRecord> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return {}
    const migrated: Record<string, PendingRecord> = {}
    for (const [key, old] of Object.entries(parsed as Record<string, never>)) {
      const entry = old as unknown as {
        token: string
        serviceTimeId: number
        date: string
        attendance: number | null
        streaming: number | null
        updatedAt: number
      }
      if (!entry?.token) continue
      migrated[key] = {
        token: entry.token,
        serviceTimeId: entry.serviceTimeId,
        date: entry.date,
        correction: {attendance: entry.attendance ?? null, streaming: entry.streaming ?? null},
        tallies: [],
        updatedAt: entry.updatedAt ?? Date.now(),
      }
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return migrated
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

/** Called after each entry lands, with the server's resulting values, so caches can refresh. */
let onSynced: ((token: string, record: RecordValue) => void) | null = null
export function setSyncedHandler(handler: ((token: string, record: RecordValue) => void) | null): void {
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

function writeEntry(key: string, entry: PendingRecord | null): void {
  const pending = {...state.pending}
  if (entry === null || (entry.correction === null && entry.tallies.length === 0)) delete pending[key]
  else pending[key] = entry
  persist(pending)
  emit({pending, error: null})
}

interface RecordRef {
  token: string
  serviceTimeId: number
  date: string
}

/** Queue one tally key press. Synchronously durable before this returns. */
export function queueTally(ref: RecordRef, field: Field, adjustment: number): void {
  const key = recordKey(ref.token, ref.serviceTimeId, ref.date)
  const now = Date.now()
  const existing = state.pending[key]
  const tallies = [...(existing?.tallies ?? [])]

  // Only the newest bucket for this field is still open, and only for a while.
  let openIndex = -1
  for (let i = tallies.length - 1; i >= 0; i--) {
    if (tallies[i].field === field) {
      openIndex = i
      break
    }
  }
  const open = openIndex >= 0 ? tallies[openIndex] : null
  if (open && now - open.firstTappedAt < BUCKET_MS) {
    const merged = {...open, adjustment: open.adjustment + adjustment}
    // A bucket that nets out to nothing has nothing to send.
    if (merged.adjustment === 0) tallies.splice(openIndex, 1)
    else tallies[openIndex] = merged
  } else {
    tallies.push({field, adjustment, firstTappedAt: now})
  }

  writeEntry(key, {
    token: ref.token,
    serviceTimeId: ref.serviceTimeId,
    date: ref.date,
    correction: existing?.correction ?? null,
    tallies,
    updatedAt: now,
  })
  scheduleFlush()
}

/** Queue a typed value for both fields. Supersedes anything this device has queued for the record. */
export function queueCorrection(ref: RecordRef, values: {attendance: number | null; streaming: number | null}): void {
  const key = recordKey(ref.token, ref.serviceTimeId, ref.date)

  if (values.attendance === null && values.streaming === null) {
    // The server rejects an all-empty record, so there is nothing to send. Drop any queued entry
    // rather than leaving one that can never drain and would pin the "pending" badge on.
    if (!(key in state.pending)) return
    writeEntry(key, null)
    return
  }

  // Tallies queued before a Correction are part of the number that was just typed.
  writeEntry(key, {
    token: ref.token,
    serviceTimeId: ref.serviceTimeId,
    date: ref.date,
    correction: values,
    tallies: [],
    updatedAt: Date.now(),
  })
  scheduleFlush()
}

/** Retire a piece of an entry, unless it was re-queued while the request was in flight. */
function settleCorrection(key: string, sent: PendingRecord['correction']): void {
  const current = state.pending[key]
  if (!current || current.correction !== sent) return
  writeEntry(key, {...current, correction: null})
}

function settleTally(key: string, sent: TallyBucket): void {
  const current = state.pending[key]
  if (!current) return
  const index = current.tallies.indexOf(sent)
  if (index < 0) return
  const tallies = [...current.tallies]
  tallies.splice(index, 1)
  writeEntry(key, {...current, tallies})
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

  // A 4xx is specific to one piece — leave it queued (never silently drop a count) but keep
  // draining the rest. No response at all, or a sick server, means the network is the problem:
  // stop hammering it and retry the whole queue on a backoff.
  outer: for (const [key, record] of entries) {
    // The Correction goes first: this device's later taps are meant to land on top of it.
    if (record.correction) {
      try {
        const saved = await saveCorrection(record.token, {
          serviceTimeId: record.serviceTimeId,
          date: record.date,
          ...record.correction,
        })
        settleCorrection(key, record.correction)
        onSynced?.(record.token, saved)
      } catch (error) {
        failure = error instanceof Error ? error.message : 'Could not sync'
        if (!(error instanceof ApiError) || error.status >= 500) break outer
        continue
      }
    }

    for (const bucket of record.tallies) {
      try {
        const saved = await saveTally(record.token, {
          serviceTimeId: record.serviceTimeId,
          date: record.date,
          field: bucket.field,
          adjustment: bucket.adjustment,
          tappedAt: new Date(bucket.firstTappedAt).toISOString(),
        })
        settleTally(key, bucket)
        onSynced?.(record.token, saved)
      } catch (error) {
        failure = error instanceof Error ? error.message : 'Could not sync'
        if (!(error instanceof ApiError) || error.status >= 500) break outer
      }
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

/**
 * What this device should show: the freshest value it has been told about, plus its own un-drained
 * entries on top. An offline screen still counts up from the last value it saw, and folds in a
 * newer one from another device without losing the taps in hand (ADR-0027).
 */
export function resolveRecord(
  snapshot: OutboxState,
  token: string,
  serviceTimeId: number,
  date: string,
  server: {attendance: number | null; streaming: number | null} | undefined,
): {attendance: number | null; streaming: number | null; pending: boolean} {
  const queued = selectPending(snapshot, token, serviceTimeId, date)
  const base = queued?.correction ?? {attendance: server?.attendance ?? null, streaming: server?.streaming ?? null}
  if (!queued || queued.tallies.length === 0) {
    return {...base, pending: Boolean(queued)}
  }

  const value = {...base}
  for (const bucket of queued.tallies) {
    value[bucket.field] = Math.max(0, (value[bucket.field] ?? 0) + bucket.adjustment)
  }
  return {...value, pending: true}
}
