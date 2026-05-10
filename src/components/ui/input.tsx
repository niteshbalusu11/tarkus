import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-lg border border-[var(--line-strong)] bg-[#fffefa] px-3 py-2 text-base text-[var(--charcoal)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[color-mix(in_oklab,var(--charcoal-muted)_78%,white)] focus-visible:border-[var(--amber)] focus-visible:ring-3 focus-visible:ring-[rgba(201,146,26,0.2)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-80 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
