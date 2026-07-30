import { test, expect } from '@playwright/test'

// Este spec se prueba sin sesión — pisa el storageState del proyecto
// `chromium` (que arranca autenticado vía auth.setup.ts) con uno vacío.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login', () => {
  test('permite iniciar sesión con credenciales válidas', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Correo electrónico').fill('admin@homelab.cl')
    await page.getByLabel('Contraseña').fill('admin123')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()

    await page.waitForURL('**/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Correo electrónico').fill('admin@homelab.cl')
    await page.getByLabel('Contraseña').fill('password-incorrecta')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()

    await expect(page.getByText('Correo o contraseña incorrectos')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('sin sesión, /dashboard redirige a /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
