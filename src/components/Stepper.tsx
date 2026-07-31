import {Button} from '@/components/ui/Button'
import {haptic} from '@/lib/haptics'

interface Props {
  value: number
  onChange: (n: number) => void
  label: string
}

// Big tap-to-count stepper for live tallying. Each press fires a short haptic so counting can be
// eyes-off — the two directions get different durations so they're distinguishable by feel.
export function Stepper({value, onChange, label}: Props) {
  const step = (next: number, ms: number) => {
    haptic(ms)
    onChange(next)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center justify-center gap-6">
        <Button
          variant="outline"
          onClick={() => step(Math.max(0, value - 1), 22)}
          disabled={value <= 0}
          className="!w-20 !h-20 !rounded-full text-4xl"
          aria-label="decrease"
        >
          −
        </Button>
        <div className="min-w-24 text-center">
          <div className="text-6xl font-bold tabular-nums">{value}</div>
        </div>
        <Button
          variant="outline"
          onClick={() => step(value + 1, 10)}
          className="!w-20 !h-20 !rounded-full text-4xl"
          aria-label="increase"
        >
          +
        </Button>
      </div>
    </div>
  )
}
