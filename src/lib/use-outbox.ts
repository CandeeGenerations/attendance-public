import {type OutboxState, getSnapshot, setSyncedHandler, startOutbox, subscribe} from '@/lib/outbox'
import {useQueryClient} from '@tanstack/react-query'
import {useEffect, useSyncExternalStore} from 'react'

export function useOutbox(): OutboxState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// Mounted once at the app root: drains the queue in the background and folds each synced value
// back into the query cache so the pick list agrees with what was just written.
export function useOutboxSync(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    setSyncedHandler((record) => {
      queryClient.setQueryData(['record', record.token, record.serviceTimeId, record.date], {
        serviceTimeId: record.serviceTimeId,
        date: record.date,
        attendance: record.attendance,
        streaming: record.streaming,
      })
    })
    const stop = startOutbox()
    return () => {
      setSyncedHandler(null)
      stop()
    }
  }, [queryClient])
}
