import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ControlTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: React.ReactNode
  isPlaceholder?: boolean
}

/**
 * Trigger compartido para controles tipo "botón que abre un popover" (date picker,
 * time picker) que deben verse como un `.hl-input` más — misma altura, radio,
 * tipografía y borde que el resto de los inputs del Design System, y que reescalan
 * juntos al cambiar `data-density`.
 */
export const ControlTrigger = React.forwardRef<HTMLButtonElement, ControlTriggerProps>(
  ({ icon, label, isPlaceholder, className, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'hl-input hl-input--select w-full',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {icon}
      {/* El color va en el span, no en el botón: .hl-input define `color` sin
          @layer, así que le gana a cualquier utility de Tailwind puesta en el
          <button>. Sobre el span sí manda. */}
      <span
        className="truncate"
        style={{
          flex: 1,
          textAlign: 'left',
          color: isPlaceholder ? 'var(--color-fg-subtle)' : 'var(--color-fg)',
        }}
      >
        {label}
      </span>
    </button>
  ),
)
ControlTrigger.displayName = 'ControlTrigger'
