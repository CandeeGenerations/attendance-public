import {cn} from '@/lib/utils'
import * as React from 'react'

export function Card({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-card text-card-foreground border border-border rounded-3xl shadow-sm p-6', className)}
      {...props}
    />
  )
}
