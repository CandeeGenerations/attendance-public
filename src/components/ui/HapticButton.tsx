import {buttonClasses} from '@/components/ui/Button'
import {type HapticShape, haptic} from '@/lib/haptics'
import {cn} from '@/lib/utils'

interface Props {
  onPress: () => void
  label: string
  disabled?: boolean
  className?: string
  /** Which vibration shape to play on Android; iOS gets its one fixed system tick regardless. */
  shape?: HapticShape
  children: React.ReactNode
}

// A button whose tap target is a real, invisible `<input type="checkbox" switch>`.
//
// Since iOS 26.5 a haptic fires only when the finger lands directly on a native WebKit switch —
// scripting a click no longer works — so the control has to *be* the button rather than sit
// offscreen. Two rules make this work and are easy to break:
//   • no `appearance: none` — stripping the native look also strips the haptic
//   • `clip-path`, not `overflow: hidden` — only clip-path trims the control's hit region to the
//     visible circle, otherwise the square switch swallows taps outside the button
// The checkbox's checked state is deliberately ignored; it exists purely as a haptic actuator, so
// it stays uncontrolled and is free to toggle on every press.
export function HapticButton({onPress, label, disabled = false, className, shape = 'tick', children}: Props) {
  return (
    <span
      className={cn(
        buttonClasses({variant: 'outline', className}),
        'relative',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span aria-hidden="true">{children}</span>
      <input
        type="checkbox"
        {...{switch: ''}}
        aria-label={label}
        disabled={disabled}
        // Buzz on finger-down, where iOS already plays its tick, so both platforms answer the tap
        // at the same instant. It also keeps the call in the clearest possible user gesture: a
        // vibration requested from anywhere Chrome doesn't count as user activation is dropped.
        onPointerDown={() => haptic(shape)}
        onChange={onPress}
        className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 [clip-path:inset(0_round_9999px)] disabled:cursor-not-allowed"
      />
    </span>
  )
}
