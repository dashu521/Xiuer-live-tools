import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-destructive/30 bg-destructive/12 text-red-100 shadow-sm',
        outline: 'text-foreground',
        dark: 'border-transparent bg-foreground text-background hover:bg-foreground/90',
        success: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-100',
        warning: 'border-amber-500/30 bg-amber-500/12 text-amber-100',
        info: 'border-sky-500/30 bg-sky-500/12 text-sky-100',
        neutral: 'border-border/70 bg-muted/55 text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
