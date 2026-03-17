import type * as React from 'react'
import { cn } from '@/lib/utils'

const Input = ({ className, type, ...props }: React.ComponentProps<'input'>) => {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
      onKeyDown={e => {
        e.stopPropagation()
        props.onKeyDown?.(e)
      }}
    />
  )
}
Input.displayName = 'Input'

export { Input }
