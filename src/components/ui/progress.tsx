/** Barra de progreso — `.hl-progress`. `value` en 0–100. */
export function Progress({ value }: { value: number }) {
  return (
    <div className="hl-progress">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
