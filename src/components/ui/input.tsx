import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  wrapperClassName?: string
  startAdornment?: React.ReactNode
  endAdornment?: React.ReactNode
  hasError?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, startAdornment, endAdornment, hasError, ...props }, ref) => (
    <div className={cn('hl-input', hasError && 'has-error', wrapperClassName)}>
      {startAdornment && <span className="hl-affix">{startAdornment}</span>}
      <input ref={ref} className={className} {...props} />
      {endAdornment && <span className="hl-affix">{endAdornment}</span>}
    </div>
  )
)
Input.displayName = 'Input'

export { Input }
