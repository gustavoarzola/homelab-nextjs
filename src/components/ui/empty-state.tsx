import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

/** Estado vacío de tabla/listado — `.hl-empty`. */
export function EmptyState({ title, description, icon }: { title: ReactNode; description?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="hl-empty">
      {icon ?? <Inbox />}
      <p>{title}</p>
      {description && <span>{description}</span>}
    </div>
  )
}
