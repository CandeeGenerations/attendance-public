import {Stepper} from '@/components/Stepper'
import {Button} from '@/components/ui/Button'
import {Card} from '@/components/ui/Card'
import {type ServiceTime, type Session, fetchRecord, fetchSession, getToken, saveRecord} from '@/lib/api'
import {addDays, currentWeekStart, dayHeading, formatTime, resolveServiceDate, weekLabel} from '@/lib/date'
import {useMutation, useQuery} from '@tanstack/react-query'
import {useEffect, useMemo, useState} from 'react'

type Selected = {st: ServiceTime; date: string}
type Field = 'attendance' | 'streaming'

export default function App() {
  const token = getToken()
  const {data: session, isLoading, error} = useQuery({
    queryKey: ['session', token],
    queryFn: () => fetchSession(token),
    enabled: !!token,
    retry: false,
  })
  const [weekStart, setWeekStart] = useState(currentWeekStart())
  const [selected, setSelected] = useState<Selected | null>(null)

  if (!token || error) {
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
  if (isLoading || !session) {
    return (
      <Shell>
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      </Shell>
    )
  }

  return (
    <Shell>
      <RecordingHeader name={session.recorderName} />
      {selected ? (
        <EntryScreen token={token} selected={selected} onBack={() => setSelected(null)} />
      ) : (
        <PickScreen
          session={session}
          weekStart={weekStart}
          onWeek={setWeekStart}
          onPick={(st) => setSelected({st, date: resolveServiceDate(weekStart, st.dayOfWeek)})}
        />
      )}
    </Shell>
  )
}

function Shell({children}: {children: React.ReactNode}) {
  return (
    <main className="min-h-svh bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md space-y-5">{children}</div>
    </main>
  )
}

function RecordingHeader({name}: {name: string}) {
  return (
    <p className="text-sm text-muted-foreground px-1">
      Recording as <span className="font-semibold text-foreground">{name}</span>
    </p>
  )
}

function PickScreen({
  session,
  weekStart,
  onWeek,
  onPick,
}: {
  session: Session
  weekStart: string
  onWeek: (w: string) => void
  onPick: (st: ServiceTime) => void
}) {
  // Group by dayOfWeek, preserving sort order within a day.
  const groups = useMemo(() => {
    const byDay = new Map<number, ServiceTime[]>()
    for (const st of session.serviceTimes) {
      const arr = byDay.get(st.dayOfWeek) ?? []
      arr.push(st)
      byDay.set(st.dayOfWeek, arr)
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0])
  }, [session])

  return (
    <>
      <Card className="!p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Week of</p>
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" className="!w-14 !h-12 text-xl" onClick={() => onWeek(addDays(weekStart, -7))}>
            ‹
          </Button>
          <span className="font-semibold text-lg">{weekLabel(weekStart)}</span>
          <Button variant="outline" className="!w-14 !h-12 text-xl" onClick={() => onWeek(addDays(weekStart, 7))}>
            ›
          </Button>
        </div>
      </Card>

      <h1 className="text-2xl font-bold px-1">Choose your Service Time</h1>

      {groups.map(([day, list]) => (
        <div key={day} className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground px-1">
            {dayHeading(resolveServiceDate(weekStart, day))}
          </p>
          <Card className="!p-0 divide-y overflow-hidden">
            {list.map((st) => (
              <button
                key={st.id}
                onClick={() => onPick(st)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted active:bg-muted/80 cursor-pointer"
              >
                <span className="text-lg font-medium">{formatTime(st.time)}</span>
                <span className="text-muted-foreground text-xl">›</span>
              </button>
            ))}
          </Card>
        </div>
      ))}
    </>
  )
}

function EntryScreen({token, selected, onBack}: {token: string; selected: Selected; onBack: () => void}) {
  const {st, date} = selected
  const {data: existing, isLoading} = useQuery({
    queryKey: ['record', token, st.id, date],
    queryFn: () => fetchRecord(token, st.id, date),
  })

  const [mode, setMode] = useState<'tally' | 'type'>('tally')
  const [field, setField] = useState<Field>('attendance')
  const [att, setAtt] = useState<number | null>(null)
  const [strm, setStrm] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (existing && !loaded) {
      setAtt(existing.attendance)
      setStrm(existing.streaming)
      setLoaded(true)
    }
  }, [existing, loaded])

  const mut = useMutation({
    mutationFn: () => saveRecord(token, {serviceTimeId: st.id, date, attendance: att, streaming: strm}),
  })

  const canSave = att !== null || strm !== null
  const current = field === 'attendance' ? att : strm
  const setCurrent = (n: number) => (field === 'attendance' ? setAtt(n) : setStrm(n))

  return (
    <>
      <button onClick={onBack} className="text-muted-foreground text-sm px-1 cursor-pointer">
        ‹ Back
      </button>
      <div className="px-1">
        <h1 className="text-2xl font-bold">{formatTime(st.time)}</h1>
        <p className="text-muted-foreground">{dayHeading(date)}</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground px-1">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" selected={mode === 'tally'} onClick={() => setMode('tally')}>
              Tally
            </Button>
            <Button variant="outline" selected={mode === 'type'} onClick={() => setMode('type')}>
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
              <Stepper value={current ?? 0} onChange={setCurrent} label={field === 'attendance' ? 'Attendance' : 'Streaming'} />
              <div className="flex justify-around text-center pt-2 border-t">
                <ReadOut label="Attendance" value={att} />
                <ReadOut label="Streaming" value={strm} />
                <ReadOut label="Total" value={att === null && strm === null ? null : (att ?? 0) + (strm ?? 0)} />
              </div>
            </Card>
          ) : (
            <Card className="space-y-4">
              <NumberInput label="Attendance" value={att} onChange={setAtt} />
              <NumberInput label="Streaming" value={strm} onChange={setStrm} />
            </Card>
          )}

          <Button size="lg" disabled={!canSave || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : mut.isSuccess ? '✓ Saved' : 'Save'}
          </Button>
          {mut.isSuccess && <p className="text-center text-green-600 font-medium">Saved</p>}
          {mut.error && (
            <p className="text-center text-destructive">{mut.error instanceof Error ? mut.error.message : 'Save failed'}</p>
          )}
        </>
      )}
    </>
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

function NumberInput({label, value, onChange}: {label: string; value: number | null; onChange: (n: number | null) => void}) {
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
