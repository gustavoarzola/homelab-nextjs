import { db } from './index'
import { users } from './schema'
import bcrypt from 'bcryptjs'

async function seed() {
  console.log('🌱 Seeding database...')

  await db.delete(users)

  const adminHash = await bcrypt.hash('admin123', 10)
  const userHash = await bcrypt.hash('user123', 10)

  await db.insert(users).values([
    {
      nombre: 'Administrador',
      correo: 'admin@homelab.cl',
      contrasena: adminHash,
      rol: 'admin',
      activo: true,
    },
    {
      nombre: 'Usuario Demo',
      correo: 'usuario@homelab.cl',
      contrasena: userHash,
      rol: 'usuario',
      activo: true,
    },
  ])

  console.log('✅ Seed completado:')
  console.log('   admin@homelab.cl   / admin123  (rol: admin)')
  console.log('   usuario@homelab.cl / user123   (rol: usuario)')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed fallido:', err)
  process.exit(1)
})
