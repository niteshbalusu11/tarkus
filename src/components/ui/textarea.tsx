import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-lg border border-[var(--line-strong)] bg-[#fffefa] px-3 py-2.5 text-base text-[var(--charcoal)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-colors outline-none placeholder:text-[color-mix(in_oklab,var(--charcoal-muted)_78%,white)] focus-visible:border-[var(--amber)] focus-visible:ring-3 focus-visible:ring-[rgba(201,146,26,0.2)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-80 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
