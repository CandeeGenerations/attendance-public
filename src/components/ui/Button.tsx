import {cn} from '@/lib/utils'
import * as React from 'react'

type Variant = 'default' | 'outline' | 'ghost' | 'destructive'
type Size = 'default' | 'lg' | 'xl'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  selected?: boolean
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50',
  outline: 'bg-card text-foreground border border-border hover:bg-muted active:bg-muted/80 disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-muted active:bg-muted/80 disabled:opacity-50',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/30',
}

const sizeClasses: Record<Size, string> = {
  default: 'h-14 px-5 text-base rounded-2xl',
  lg: 'h-16 px-6 text-lg rounded-2xl',
  xl: 'h-20 px-6 text-xl rounded-2xl',
}

// Exported so anchors and router <Link>s can wear the same skin without a Slot polyfill.
export function buttonClasses({
  variant = 'default',
  size = 'default',
  selected = false,
  className,
}: {variant?: Variant; size?: Size; selected?: boolean; className?: string} = {}) {
  return cn(
    'w-full inline-flex items-center justify-center gap-2 font-medium transition-colors select-none cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
    'disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    selected && variant !== 'default' && 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
    className,
  )
}

export function Button({className, variant, size, selected, type = 'button', ...props}: ButtonProps) {
  return <button type={type} className={buttonClasses({variant, size, selected, className})} {...props} />
}
