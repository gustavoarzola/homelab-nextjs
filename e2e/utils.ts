import type { Page } from '@playwright/test'

/**
 * Abre un <SelectCombobox> (src/components/select-combobox.tsx) ubicándolo
 * por su placeholder visual.
 *
 * OJO: el `<input>` real siempre tiene `placeholder=''` — el texto de
 * placeholder se renderiza en un `<span>` hermano con `pointer-events:none`
 * superpuesto. `getByPlaceholder()` NO funciona acá. En cambio, ubicamos ese
 * span por texto exacto y clickeamos el `<input>` hermano dentro del mismo
 * contenedor (el click en el span pasaría igual al input por el
 * pointer-events:none, pero clickear el input directamente evita problemas
 * de "receives pointer events" en el actionability check de Playwright).
 *
 * Solo sirve para el estado inicial (sin selección / sin query), que es
 * cuando ese placeholder está efectivamente visible — que es siempre el caso
 * en estos specs (abrimos cada combobox una sola vez).
 */
export async function openCombobox(page: Page, placeholder: string) {
  const trigger = page.getByText(placeholder, { exact: true }).locator('xpath=..').locator('input')
  await trigger.click()
}

/** Lista de opciones de un <SelectCombobox> abierto (portal en document.body). */
export function comboboxOptions(page: Page) {
  return page.locator('ul.max-h-52.overflow-y-auto li')
}

/**
 * Selecciona un día del <SimpleCalendar> (react-day-picker) actualmente
 * abierto, por el número visible (no por accesible-name: react-day-picker
 * pone en `aria-label` la fecha completa, ej. "domingo, 15 de marzo de
 * 2026", no "15").
 */
export function calendarDayButton(page: Page, day: number) {
  return page.locator('button').filter({ hasText: new RegExp(`^${day}$`) })
}

/**
 * Navega el calendario abierto hacia atrás hasta el mes/año objetivo.
 *
 * `monthNamesLower` acepta variantes del nombre del mes en varios idiomas:
 * en build de producción (`next build`/`next start`) observamos que el
 * caption del calendario (`SimpleCalendar`, que pasa `locale={es}` de
 * date-fns) se renderiza en inglés — aparente diferencia de bundling entre
 * dev y prod que excede el alcance de esta suite E2E — así que no asumimos
 * un idioma fijo.
 */
export async function navigateCalendarBackTo(page: Page, monthNamesLower: string[], year: string) {
  const caption = page.locator('.rdp-caption_label')
  for (let i = 0; i < 36; i++) {
    const text = ((await caption.textContent()) ?? '').toLowerCase()
    if (monthNamesLower.some((m) => text.includes(m)) && text.includes(year)) return
    await page.getByRole('button', { name: 'Go to the Previous Month' }).click()
  }
  throw new Error(`No se pudo navegar el calendario hasta ${monthNamesLower.join('/')} de ${year}`)
}

/** "$25.000" → 25000 */
export function parseCLP(text: string): number {
  const digits = text.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : 0
}
