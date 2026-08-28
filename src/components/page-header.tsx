import type { ReactNode } from 'react'

type Props = {
  crumb?: ReactNode
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ crumb, title, meta, actions }: Props) {
  return (
    <div className="page-head">
      <div>
        {crumb && <div className="page-head__crumb">{crumb}</div>}
        <h1>{title}</h1>
        {meta && <p className="page-head__meta">{meta}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  )
}
