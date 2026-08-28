import { cn } from '@/lib/utils'

type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/** Toggle on/off — `.hl-switch`. */
export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn('hl-switch', className)}
      data-on={checked ? '' : undefined}
      {...aria}
    />
  )
}
