import {HapticButton} from '@/components/ui/HapticButton'

interface Props {
  value: number
  /** ±1, not a new total: a tap is an adjustment (ADR-0027). */
  onAdjust: (delta: number) => void
  label: string
}

// Big tap-to-count stepper for live tallying. Both keys are HapticButtons so counting can be
// eyes-off; on Android the two directions buzz in different shapes — one tick up, two down — so
// they're distinguishable without looking (iOS gives one fixed system tick either way).
//
// The increase key is half again the size of the decrease one. It takes nearly every tap of a
// service, and the asymmetry is itself a cue: the big circle is the one you reach for blind.
// `shrink-0` keeps both keys circular — a squashed key on a narrow phone would move its centre,
// and the count is the piece that gives way instead, sized fluidly so three digits fit next to a
// 7.5rem key on a 375px screen without ever shrinking a tap target.
export function Stepper({value, onAdjust, label}: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center justify-center gap-4">
        <HapticButton
          label="decrease"
          disabled={value <= 0}
          shape="double"
          onPress={() => onAdjust(-1)}
          className="!w-20 !h-20 shrink-0 !rounded-full text-4xl"
        >
          −
        </HapticButton>
        <div className="min-w-16 text-center">
          <div className="text-[clamp(2rem,10vw,3.75rem)] leading-none font-bold tabular-nums">{value}</div>
        </div>
        <HapticButton
          label="increase"
          shape="tick"
          onPress={() => onAdjust(1)}
          className="!w-30 !h-30 shrink-0 !rounded-full text-5xl"
        >
          +
        </HapticButton>
      </div>
    </div>
  )
}
