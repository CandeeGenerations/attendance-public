import {SyncStatusBar} from '@/components/SyncStatusBar'
import {Card} from '@/components/ui/Card'
import {ApiError, type Session, fetchSession} from '@/lib/api'
import {useOutboxSync} from '@/lib/use-outbox'
import {useQuery} from '@tanstack/react-query'
import {createContext, use} from 'react'
import {Outlet, useParams} from 'react-router-dom'

interface Recorder {
  token: string
  session: Session
}

const RecorderContext = createContext<Recorder | null>(null)

export function useRecorder(): Recorder {
  const value = use(RecorderContext)
  if (!value) throw new Error('useRecorder must be used within RecorderLayout')
  return value
}

export function Shell({children}: {children: React.ReactNode}) {
  return (
    <main className="min-h-svh bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md space-y-5">{children}</div>
    </main>
  )
}

export function InvalidLink() {
  return (
    <Shell>
      <Card className="text-center">
        <h1 className="text-xl font-semibold mb-2">Link not valid</h1>
        <p className="text-muted-foreground">
          This attendance link isn’t valid or has been retired. Ask for a new one.
        </p>
      </Card>
    </Shell>
  )
}

export function RecorderLayout() {
  const {token = ''} = useParams()
  useOutboxSync()

  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['session', token],
    queryFn: () => fetchSession(token),
    enabled: !!token,
    // A rejected token is final; an unreachable network is not. Keep retrying the latter so the
    // app recovers on its own when signal comes back mid-service.
    retry: (attempt, err) => !(err instanceof ApiError) && attempt < 5,
    retryDelay: (attempt) => Math.min(30_000, 1_000 * 2 ** attempt),
  })

  if (!token || error instanceof ApiError) return <InvalidLink />

  if (error) {
    return (
      <Shell>
        <SyncStatusBar />
        <Card className="text-center">
          <h1 className="text-xl font-semibold mb-2">Can’t reach the server</h1>
          <p className="text-muted-foreground">
            You appear to be offline. This page will load as soon as you’re back in range — any counts you’ve already
            entered are saved on this device.
          </p>
        </Card>
      </Shell>
    )
  }

  if (isLoading || !session) {
    return (
      <Shell>
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      </Shell>
    )
  }

  return (
    <Shell>
      <p className="text-sm text-muted-foreground px-1">
        Recording as <span className="font-semibold text-foreground">{session.recorderName}</span>
      </p>
      <SyncStatusBar />
      <RecorderContext value={{token, session}}>
        <Outlet />
      </RecorderContext>
    </Shell>
  )
}
