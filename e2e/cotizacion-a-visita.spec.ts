import { test, expect, type Page } from '@playwright/test'
import { openCombobox, comboboxOptions } from './utils'

async function closeDropdowns(page: Page) {
  await page.getByRole('heading', { name: 'Nueva cotización' }).click()
}

test('crea una cotización con paciente y la convierte en visita', async ({ page }) => {
  // ── Crear cotización ──
  await page.goto('/cotizaciones/nueva')
  await expect(page.getByRole('heading', { name: 'Nueva cotización' })).toBeVisible()

  // Paciente (modo single → autocompleta comuna y cierra el dropdown solo).
  // Con paciente seleccionado, la cotización queda con `hasPaciente=true` y
  // el flujo de aceptación no pide elegir paciente de nuevo.
  await openCombobox(page, 'Buscar por nombre, RUT o teléfono…')
  await comboboxOptions(page).first().click()
  await expect(page.getByText('desde paciente')).toBeVisible()

  // Un procedimiento, para que la cotización no quede vacía (modo multi →
  // hay que cerrar el dropdown a mano)
  await openCombobox(page, 'Buscar procedimiento…')
  await comboboxOptions(page).first().click()
  await closeDropdowns(page)

  await page.getByRole('button', { name: 'Crear cotización' }).click()
  await page.waitForURL(/\/cotizaciones\/\d+$/)

  // ── Estado: creada → enviada ──
  // (el botón "Marcar como enviada" solo existe en el panel del estado 'creada')
  await expect(page.getByRole('button', { name: 'Marcar como enviada' })).toBeVisible()
  await page.getByRole('button', { name: 'Marcar como enviada' }).click()
  await expect(page.getByRole('button', { name: 'Aceptada' })).toBeVisible()

  // ── Estado: enviada → aceptada (crea la visita) ──
  await page.getByRole('button', { name: 'Aceptada' }).click()
  await page.getByRole('button', { name: 'Aceptar y crear visita' }).click()

  // aceptarCotizacion() redirige a /visitas/[idVisita] (VisitaLifecycleView,
  // encabezado con código "V-00123")
  await page.waitForURL(/\/visitas\/\d+$/)
  await expect(page.getByRole('heading', { name: /^V-\d+/ })).toBeVisible()
})
