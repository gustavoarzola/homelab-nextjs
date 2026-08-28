import { test, expect, type Page } from '@playwright/test'
import { openCombobox, comboboxOptions, calendarDayButton, parseCLP } from './utils'

/** Cierra cualquier dropdown de SelectCombobox abierto haciendo click en un
 * área neutra (el título del formulario, fuera de cualquier popover). */
async function closeDropdowns(page: Page) {
  await page.getByRole('heading', { name: 'Nueva visita' }).click()
}

test('crea una visita con descuento en procedimiento + insumos y el costo se refleja en el formulario y tras guardar', async ({ page }) => {
  // ── Ir al formulario de nueva visita desde el listado de pacientes ──
  await page.goto('/pacientes')
  await page.getByTitle('Nueva visita').first().click()
  await page.waitForURL(/\/visitas\/nueva\?pacienteId=\d+/)
  await expect(page.getByRole('heading', { name: 'Nueva visita' })).toBeVisible()

  // ── Fecha (requerida) — día 15 del mes visible (nunca ambiguo con días
  // "outside" del mes adyacente, que solo aparecen cerca de los bordes 1 y
  // 28-31) ──
  await page.getByRole('button', { name: 'Seleccionar fecha' }).click()
  await calendarDayButton(page, 15).click()

  // ── Procedimientos: seleccionar el primero del catálogo ──
  await openCombobox(page, 'Buscar procedimiento…')
  await comboboxOptions(page).first().click()
  await closeDropdowns(page)

  const totalVisita = page.getByText('Total visita', { exact: true }).locator('xpath=following-sibling::span')
  await expect(totalVisita).toBeVisible()
  const totalBaseline = parseCLP((await totalVisita.textContent()) ?? '')
  expect(totalBaseline).toBeGreaterThan(0)

  // ── Descuento sobre el procedimiento seleccionado ──
  const descuentoInput = page.locator('span:text-is("Desc. $") + input[type="number"]')
  await descuentoInput.fill('2000')

  // ── Insumos ──
  await page.locator('#montoInsumosInput').fill('5000')

  // El preview del formulario debe reflejar: precio - descuento + insumos
  await expect(async () => {
    const totalAfter = parseCLP((await totalVisita.textContent()) ?? '')
    expect(totalAfter).toBe(totalBaseline - 2000 + 5000)
  }).toPass()
  const totalAfter = parseCLP((await totalVisita.textContent()) ?? '')

  // ── Guardar ──
  await page.getByRole('button', { name: 'Crear visita' }).click()
  await page.waitForURL(/\/visitas\/\d+$/)

  // ── El costo persistido debe coincidir con el preview ──
  // Vista de ciclo de vida (post-guardado): fila "Total" como <dt>/<dd> dentro
  // de .hl-kv--total (design-system paso 06), no un par de <span> como en el
  // formulario de creación.
  const totalPersistido = page.locator('.hl-kv--total dd')
  await expect(totalPersistido).toBeVisible()
  const persisted = parseCLP((await totalPersistido.textContent()) ?? '')
  expect(persisted).toBe(totalAfter)
})
