import {type Week} from '@/lib/api'
import {weekStartOf} from '@/lib/date'
import {type OutboxState, getSnapshot, setSyncedHandler, startOutbox, subscribe} from '@/lib/outbox'
import {weekQueryKey} from '@/lib/use-week'
import {useQueryClient} from '@tanstack/react-query'
import {useEffect, useSyncExternalStore} from 'react'

export function useOutbox(): OutboxState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// Mounted once at the app root: drains the queue in the background and folds each synced value
// back into the week cache, so the pick list and the entry screen agree with what was just written
// without waiting for the next poll.
export function useOutboxSync(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    // A poll that was already in flight when a write committed answers with the old number, so a
    // freshly synced count can be repainted stale for a moment. Patch the cache immediately, then
    // revalidate once the queue goes quiet — coalesced, so a long offline drain triggers one
    // refetch rather than one per entry.
    const stale = new Set<string>()
    let revalidate: ReturnType<typeof setTimeout> | null = null

    setSyncedHandler((token, record) => {
      const key = weekQueryKey(token, weekStartOf(record.date))
      queryClient.setQueryData(key, (previous: Week | undefined) => {
        if (!previous) return previous
        return {
          ...previous,
          records: previous.records.map((r) =>
            r.serviceTimeId === record.serviceTimeId && r.date === record.date
              ? {...r, attendance: record.attendance, streaming: record.streaming}
              : r,
          ),
        }
      })

      stale.add(JSON.stringify(key))
      if (revalidate) clearTimeout(revalidate)
      revalidate = setTimeout(() => {
        revalidate = null
        for (const serialized of stale) {
          void queryClient.invalidateQueries({queryKey: JSON.parse(serialized) as unknown[]})
        }
        stale.clear()
      }, 250)
    })

    const stop = startOutbox()
    return () => {
      if (revalidate) clearTimeout(revalidate)
      setSyncedHandler(null)
      stop()
    }
  }, [queryClient])
}
