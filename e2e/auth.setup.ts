import { test as setup, expect } from '@playwright/test'

// Login real contra /login (server action signIn('credentials', ...)), con
// las credenciales sembradas por seedOperacion(). Guarda el storageState para
// que el proyecto `chromium` (dependencies: ['setup']) arranque ya
// autenticado — (admin)/layout.tsx redirige a /login sin sesión.
const authFile = 'e2e/.auth/user.json'

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Correo electrónico').fill('admin@homelab.cl')
  await page.getByLabel('Contraseña').fill('admin123')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0)

  await page.context().storageState({ path: authFile })
})
