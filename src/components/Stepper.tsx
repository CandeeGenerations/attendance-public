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
export function Stepper({value, onAdjust, label}: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center justify-center gap-6">
        <HapticButton
          label="decrease"
          disabled={value <= 0}
          shape="double"
          onPress={() => onAdjust(-1)}
          className="!w-20 !h-20 !rounded-full text-4xl"
        >
          −
        </HapticButton>
        <div className="min-w-24 text-center">
          <div className="text-6xl font-bold tabular-nums">{value}</div>
        </div>
        <HapticButton
          label="increase"
          shape="tick"
          onPress={() => onAdjust(1)}
          className="!w-20 !h-20 !rounded-full text-4xl"
        >
          +
        </HapticButton>
      </div>
    </div>
  )
}
