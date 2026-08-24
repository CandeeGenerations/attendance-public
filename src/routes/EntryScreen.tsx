import {Stepper} from '@/components/Stepper'
import {Button} from '@/components/ui/Button'
import {Card} from '@/components/ui/Card'
import {dayHeading, formatTime, isWeekStart, resolveServiceDate} from '@/lib/date'
import {queueCorrection, queueTally, resolveRecord} from '@/lib/outbox'
import {type InputMode, readInputMode, writeInputMode} from '@/lib/prefs'
import {useOnline} from '@/lib/use-online'
import {useOutbox} from '@/lib/use-outbox'
import {selectWeekRecord, useWeek} from '@/lib/use-week'
import {useEffect, useRef, useState} from 'react'
import {Link, Navigate, useParams} from 'react-router-dom'

import {isInstalledApp, useColdStart} from './cold-start'
import {useRecorder} from './RecorderLayout'
import {currentWeekRoute, weekRoute} from './routes'

type Field = 'attendance' | 'streaming'

export function EntryScreen() {
  const {token, session} = useRecorder()
  const {weekStart, serviceTimeId} = useParams()
  const week = isWeekStart(weekStart) ? weekStart : null
  const st = session.serviceTimes.find((s) => String(s.id) === serviceTimeId)
  const date = week && st ? resolveServiceDate(week, st.dayOfWeek) : null

  // In a browser a link straight to a service keeps its week — it still spends the cold start, so
  // stepping back to the list doesn't then bounce the usher forward. The installed app has no
  // shared link to honour: it opens on the week it was added from, which is the bug.
  const staleAppLaunch = useColdStart() && isInstalledApp()

  const online = useOnline()
  const outbox = useOutbox()

  // Same query the pick list polls, so this screen picks up another device's count within a few
  // seconds without a request of its own.
  const {data: weekData, isLoading} = useWeek(token, staleAppLaunch ? null : week)
  const server = st ? selectWeekRecord(weekData, st.id) : undefined

  // The chosen input style is a property of the device, not the service — a desk volunteer on a
  // laptop keeps "Type", an usher on a phone keeps "Tally", across visits.
  const [mode, setMode] = useState<InputMode>(readInputMode)
  const chooseMode = (next: InputMode) => {
    setMode(next)
    writeInputMode(next)
  }

  const [field, setField] = useState<Field>('attendance')
  const edited = useRef(false)
  useEffect(() => {
    edited.current = false
  }, [st?.id, date])

  const remote = useRemoteChange(server, st?.id, date)

  if (!week || staleAppLaunch) return <Navigate to={currentWeekRoute(token)} replace />
  if (!st || !date) return <Navigate to={weekRoute(token, week)} replace />

  const {attendance, streaming, pending} = resolveRecord(outbox, token, st.id, date, server)

  // Typed values are Corrections — they replace both fields outright.
  const correct = (next: {attendance: number | null; streaming: number | null}) => {
    edited.current = true
    remote.mine(next)
    queueCorrection({token, serviceTimeId: st.id, date}, next)
  }
  const correctAttendance = (n: number | null) => correct({attendance: n, streaming})
  const correctStreaming = (n: number | null) => correct({attendance, streaming: n})

  // A tally key is an adjustment, so a count entered here and one entered on another device add up
  // instead of overwriting each other (ADR-0027).
  const tally = (delta: number) => {
    edited.current = true
    const next =
      field === 'attendance'
        ? {attendance: Math.max(0, (attendance ?? 0) + delta), streaming}
        : {attendance, streaming: Math.max(0, (streaming ?? 0) + delta)}
    remote.mine(next)
    queueTally({token, serviceTimeId: st.id, date}, field, delta)
  }

  const current = field === 'attendance' ? attendance : streaming

  return (
    <>
      <Link to={weekRoute(token, week)} className="text-muted-foreground text-sm px-1 cursor-pointer inline-block">
        ‹ Back
      </Link>
      <div className="px-1">
        <h1 className="text-2xl font-bold">{formatTime(st.time)}</h1>
        <p className="text-muted-foreground">{dayHeading(date)}</p>
      </div>

      {/* Never block the counter on the network: a queued local value is enough to keep going. */}
      {isLoading && !pending ? (
        <p className="text-muted-foreground px-1">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" selected={mode === 'tally'} onClick={() => chooseMode('tally')}>
              Tally
            </Button>
            <Button variant="outline" selected={mode === 'type'} onClick={() => chooseMode('type')}>
              Type
            </Button>
          </div>

          {mode === 'tally' ? (
            <Card className="space-y-6">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" selected={field === 'attendance'} onClick={() => setField('attendance')}>
                  Attendance
                </Button>
                <Button variant="outline" selected={field === 'streaming'} onClick={() => setField('streaming')}>
                  Streaming
                </Button>
              </div>
              <Stepper
                value={current ?? 0}
                onAdjust={tally}
                label={field === 'attendance' ? 'Attendance' : 'Streaming'}
              />
              <div className="flex justify-around text-center pt-2 border-t">
                <ReadOut label="Attendance" value={attendance} />
                <ReadOut label="Streaming" value={streaming} />
                <ReadOut
                  label="Total"
                  value={attendance === null && streaming === null ? null : (attendance ?? 0) + (streaming ?? 0)}
                />
              </div>
            </Card>
          ) : (
            <Card className="space-y-4">
              <NumberInput label="Attendance" value={attendance} onChange={correctAttendance} />
              <NumberInput label="Streaming" value={streaming} onChange={correctStreaming} />
            </Card>
          )}

          {/* A digit changing on its own is how an usher loses count — say where it came from. */}
          {remote.changed && (
            <p aria-live="polite" className="text-center text-sm text-muted-foreground">
              Updated elsewhere
            </p>
          )}

          <SaveStatus pending={pending} syncing={outbox.syncing} online={online} edited={edited.current} />
        </>
      )}
    </>
  )
}

// Flags a server value that moved without this device moving it — another phone, the laptop, or an
// admin correction. Own writes are remembered so an echo of one never reads as someone else's.
function useRemoteChange(
  server: {attendance: number | null; streaming: number | null} | undefined,
  serviceTimeId: number | undefined,
  date: string | null,
) {
  const [changed, setChanged] = useState(false)
  const seen = useRef<{attendance: number | null; streaming: number | null} | null>(null)
  const own = useRef<{attendance: number | null; streaming: number | null} | null>(null)

  // A different record is a different conversation: forget both histories.
  useEffect(() => {
    seen.current = null
    own.current = null
    setChanged(false)
  }, [serviceTimeId, date])

  const attendance = server?.attendance ?? null
  const streaming = server?.streaming ?? null
  useEffect(() => {
    if (!server) return
    const previous = seen.current
    seen.current = {attendance, streaming}
    if (!previous) return
    if (previous.attendance === attendance && previous.streaming === streaming) return
    if (own.current?.attendance === attendance && own.current?.streaming === streaming) return
    setChanged(true)
  }, [server, attendance, streaming])

  // Long enough to read mid-count, short enough not to linger over the next tap.
  useEffect(() => {
    if (!changed) return
    const timer = setTimeout(() => setChanged(false), 4_000)
    return () => clearTimeout(timer)
  }, [changed])

  return {
    changed,
    mine: (value: {attendance: number | null; streaming: number | null}) => {
      own.current = value
    },
  }
}

function SaveStatus({
  pending,
  syncing,
  online,
  edited,
}: {
  pending: boolean
  syncing: boolean
  online: boolean
  edited: boolean
}) {
  return (
    <div className="text-center text-sm font-medium h-5">
      {pending ? (
        syncing ? (
          <span className="text-muted-foreground">Saving…</span>
        ) : online ? (
          <span className="text-muted-foreground">Waiting to sync…</span>
        ) : (
          <span className="text-amber-600 dark:text-amber-500">✓ Saved on this device</span>
        )
      ) : edited ? (
        <span className="text-green-600">✓ Saved automatically</span>
      ) : null}
    </div>
  )
}

function ReadOut({label, value}: {label: string; value: number | null}) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value ?? '—'}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (n: number | null) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ''}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))))}
        className="w-full h-16 px-4 text-2xl rounded-2xl bg-card border border-border focus:outline-none focus:ring-3 focus:ring-ring/40"
      />
    </label>
  )
}
