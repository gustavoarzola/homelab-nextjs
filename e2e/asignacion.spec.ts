import { test, expect } from '@playwright/test'
import { openCombobox, comboboxOptions, calendarDayButton, navigateCalendarBackTo } from './utils'

// El seed determinista (now='2026-03-15', seed=42, ver e2e/global-setup.ts)
// genera visitas 'programada' SIN enfermera (~30% de las programadas) en el
// rango [cutoffDate=2026-03-14, now+15=2026-03-30] — ver
// src/db/seed/operacion.ts líneas ~686-720. 16 de marzo de 2026 (lunes) cae
// en ese rango.
const TARGET_MONTH = ['marzo', 'march']
const TARGET_YEAR = '2026'
const TARGET_DAY = 16

test('asigna una visita sin enfermera arrastrándola al panel de la enfermera seleccionada', async ({ page }) => {
  await page.goto('/asignacion')
  await expect(page.getByRole('heading', { name: 'Asignación de visitas' })).toBeVisible()

  // ── Ir a una fecha del rango sembrado con visitas sin asignar ──
  // El trigger del date picker siempre muestra una fecha (nunca el
  // placeholder) en esta página, con formato "DD-MM-YYYY" (ver formatDate en
  // src/lib/format.ts).
  await page.getByRole('button', { name: /^\d{2}-\d{2}-\d{4}$/ }).click()
  await navigateCalendarBackTo(page, TARGET_MONTH, TARGET_YEAR)
  await calendarDayButton(page, TARGET_DAY).click()

  const unassignedZone = page.getByTestId('dropzone-unassigned')
  const nurseZone = page.getByTestId('dropzone-nurse')

  await expect(unassignedZone.getByTestId('asignacion-card').first()).toBeVisible({ timeout: 15_000 })
  const initialUnassignedCount = await unassignedZone.getByTestId('asignacion-card').count()
  expect(initialUnassignedCount).toBeGreaterThan(0)

  // ── Seleccionar una enfermera (modo single → cierra el dropdown solo) ──
  await openCombobox(page, '— Seleccionar —')
  await comboboxOptions(page).first().click()

  // ── Drag & drop manual ──
  // @dnd-kit usa PointerSensor (activationConstraint: distance 5), que
  // reacciona a eventos de puntero reales — page.mouse.* en Chromium
  // dispatchea pointerdown/pointermove/pointerup genuinos, a diferencia de
  // simular un HTML5 dragstart/drop.
  const card = unassignedZone.getByTestId('asignacion-card').first()
  const cardBox = await card.boundingBox()
  const targetBox = await nurseZone.boundingBox()
  if (!cardBox || !targetBox) throw new Error('No se pudo obtener el bounding box del origen/destino del drag')

  const startX = cardBox.x + cardBox.width / 2
  const startY = cardBox.y + cardBox.height / 2
  const endX = targetBox.x + targetBox.width / 2
  const endY = targetBox.y + targetBox.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Varios pasos intermedios para superar el activationConstraint (distance:
  // 5) y que @dnd-kit dispare handleDragStart, y para que closestCenter
  // detecte la dropzone destino antes del mouseup.
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 })
  await page.mouse.move(endX, endY, { steps: 15 })
  await page.mouse.move(endX, endY, { steps: 2 })
  await page.mouse.up()

  // ── La tarjeta debe haberse movido a la zona de la enfermera ──
  await expect(nurseZone.getByTestId('asignacion-card').first()).toBeVisible()
  await expect(unassignedZone.getByTestId('asignacion-card')).toHaveCount(initialUnassignedCount - 1)

  // El mouseup que termina el drag deja "armado", con cierta frecuencia
  // observada empíricamente, un click fantasma que el navegador dispara
  // sobre lo que sea que quede bajo el cursor justo después — si el
  // siguiente click de Playwright fuera directo a "Guardar cambios", a veces
  // ese fantasma lo consume y el botón no llega a activar el onClick real
  // (el POST del server action de guardarAsignaciones nunca se dispara). Un
  // click intermedio en un elemento inerte reduce mucho la frecuencia, pero
  // no la elimina del todo — por eso el guardado de abajo reintenta.
  await page.getByRole('heading', { name: 'Asignación de visitas' }).click()

  // ── Guardar (con reintento: ver comentario arriba) ──
  const guardarBtn = page.getByRole('button', { name: 'Guardar cambios' })
  const toast = page.getByText('Asignaciones guardadas')
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await guardarBtn.count()) === 0) break // ya se guardó (el botón desaparece con isDirty=false)
    await guardarBtn.click({ timeout: 3_000 })
    try {
      await expect(toast).toBeVisible({ timeout: 3_000 })
      break
    } catch {
      if (attempt === 2) throw new Error('"Guardar cambios" no disparó el guardado tras 3 intentos')
    }
  }
  await expect(toast).toBeVisible()
})
