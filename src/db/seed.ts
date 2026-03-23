import { db } from './index'
import { users, nurses } from './schema'
import bcrypt from 'bcryptjs'

const nurseData = [
  { nombres: 'María José', apellidoPaterno: 'González', apellidoMaterno: 'Reyes', rut: '8.234.567-1', telefono: '+56912345001', correo: 'mjgonzalez@clinica.cl', activo: true },
  { nombres: 'Claudia Andrea', apellidoPaterno: 'Muñoz', apellidoMaterno: 'Vargas', rut: '9.345.678-5', telefono: '+56912345002', correo: 'cmunoz@clinica.cl', activo: true },
  { nombres: 'Patricia', apellidoPaterno: 'Rojas', apellidoMaterno: 'Fuentes', rut: '10.456.789-4', telefono: '+56912345003', correo: 'projas@clinica.cl', activo: true },
  { nombres: 'Daniela Paz', apellidoPaterno: 'Soto', apellidoMaterno: 'Medina', rut: '11.567.890-6', telefono: '+56912345004', correo: 'dsoto@clinica.cl', activo: true },
  { nombres: 'Valentina', apellidoPaterno: 'Morales', apellidoMaterno: 'Castro', rut: '12.678.901-7', telefono: '+56912345005', correo: 'vmorales@clinica.cl', activo: true },
  { nombres: 'Carolina Isabel', apellidoPaterno: 'Pérez', apellidoMaterno: 'Silva', rut: '13.789.012-7', telefono: '+56912345006', correo: 'cperez@clinica.cl', activo: true },
  { nombres: 'Andrea', apellidoPaterno: 'López', apellidoMaterno: 'Torres', rut: '14.890.123-6', telefono: '+56912345007', correo: 'alopez@clinica.cl', activo: true },
  { nombres: 'Pamela Alejandra', apellidoPaterno: 'Martínez', apellidoMaterno: 'Díaz', rut: '15.901.234-4', telefono: '+56912345008', correo: 'pmartinez@clinica.cl', activo: true },
  { nombres: 'Javiera', apellidoPaterno: 'García', apellidoMaterno: 'Romero', rut: '16.012.345-1', telefono: '+56912345009', correo: 'jgarcia@clinica.cl', activo: true },
  { nombres: 'Camila Fernanda', apellidoPaterno: 'Hernández', apellidoMaterno: 'Vega', rut: '17.123.456-5', telefono: '+56912345010', correo: 'chernandez@clinica.cl', activo: true },
  { nombres: 'Francisca', apellidoPaterno: 'Jiménez', apellidoMaterno: 'Ramos', rut: '8.765.432-K', telefono: '+56912345011', correo: 'fjimenez@clinica.cl', activo: true },
  { nombres: 'Natalia Beatriz', apellidoPaterno: 'Flores', apellidoMaterno: 'Araya', rut: '9.876.543-3', telefono: '+56912345012', correo: 'nflores@clinica.cl', activo: true },
  { nombres: 'Alejandra', apellidoPaterno: 'Ramírez', apellidoMaterno: 'Gutiérrez', rut: '10.987.654-2', telefono: '+56912345013', correo: 'aramirez@clinica.cl', activo: true },
  { nombres: 'Constanza Paz', apellidoPaterno: 'Torres', apellidoMaterno: 'Navarro', rut: '12.111.222-1', telefono: '+56912345014', correo: 'ctorres@clinica.cl', activo: true },
  { nombres: 'Marcela', apellidoPaterno: 'Vargas', apellidoMaterno: 'Salinas', rut: '13.222.333-5', telefono: '+56912345015', correo: 'mvargas@clinica.cl', activo: true },
  { nombres: 'Lorena Andrea', apellidoPaterno: 'Castro', apellidoMaterno: 'Espinoza', rut: '14.333.444-9', telefono: '+56912345016', correo: 'lcastro@clinica.cl', activo: true },
  { nombres: 'Paola', apellidoPaterno: 'Ortiz', apellidoMaterno: 'Fuentes', rut: '15.444.555-2', telefono: '+56912345017', correo: 'portiz@clinica.cl', activo: true },
  { nombres: 'Bárbara Soledad', apellidoPaterno: 'Medina', apellidoMaterno: 'Ibáñez', rut: '16.555.666-6', telefono: '+56912345018', correo: 'bmedina@clinica.cl', activo: true },
  { nombres: 'Gabriela', apellidoPaterno: 'Vega', apellidoMaterno: 'Herrera', rut: '7.654.321-6', telefono: '+56912345019', correo: 'gvega@clinica.cl', activo: true },
  { nombres: 'Verónica Ximena', apellidoPaterno: 'Silva', apellidoMaterno: 'Campos', rut: '8.543.210-9', telefono: '+56912345020', correo: 'vsilva@clinica.cl', activo: true },
  { nombres: 'Susana', apellidoPaterno: 'Navarro', apellidoMaterno: 'Pizarro', rut: '9.432.109-3', telefono: '+56912345021', correo: 'snavarro@clinica.cl', activo: true },
  { nombres: 'Macarena Paz', apellidoPaterno: 'Espinoza', apellidoMaterno: 'Moreno', rut: '10.321.098-4', telefono: '+56912345022', correo: 'mespinoza@clinica.cl', activo: true },
  { nombres: 'Roxana', apellidoPaterno: 'Fuentes', apellidoMaterno: 'Contreras', rut: '11.210.987-0', telefono: '+56912345023', correo: 'rfuentes@clinica.cl', activo: true },
  { nombres: 'Isabel Cristina', apellidoPaterno: 'Contreras', apellidoMaterno: 'Valenzuela', rut: '12.109.876-8', telefono: '+56912345024', correo: 'icontreras@clinica.cl', activo: true },
  { nombres: 'Mónica', apellidoPaterno: 'Herrera', apellidoMaterno: 'Bravo', rut: '13.098.765-6', telefono: '+56912345025', correo: 'mherrera@clinica.cl', activo: true },
  { nombres: 'Ana Luisa', apellidoPaterno: 'Pizarro', apellidoMaterno: 'Cáceres', rut: '14.987.654-5', telefono: '+56912345026', correo: 'apizarro@clinica.cl', activo: true },
  { nombres: 'Karina', apellidoPaterno: 'Bravo', apellidoMaterno: 'Saavedra', rut: '15.876.543-8', telefono: '+56912345027', correo: 'kbravo@clinica.cl', activo: true },
  { nombres: 'Tamara Alejandra', apellidoPaterno: 'Moreno', apellidoMaterno: 'Sepúlveda', rut: '16.765.432-0', telefono: '+56912345028', correo: 'tmoreno@clinica.cl', activo: true },
  { nombres: 'Laura', apellidoPaterno: 'Valenzuela', apellidoMaterno: 'Poblete', rut: '17.654.321-3', telefono: '+56912345029', correo: 'lvalenzuela@clinica.cl', activo: true },
  { nombres: 'Pilar Eugenia', apellidoPaterno: 'Sepúlveda', apellidoMaterno: 'Meza', rut: '8.112.233-4', telefono: '+56912345030', correo: 'psepulveda@clinica.cl', activo: true },
  { nombres: 'Viviana', apellidoPaterno: 'Cáceres', apellidoMaterno: 'Leiva', rut: '9.223.344-8', telefono: '+56912345031', correo: 'vcaceres@clinica.cl', activo: true },
  { nombres: 'Fabiola Andrea', apellidoPaterno: 'Saavedra', apellidoMaterno: 'Acevedo', rut: '10.334.455-7', telefono: '+56912345032', correo: 'fsaavedra@clinica.cl', activo: true },
  { nombres: 'Ximena', apellidoPaterno: 'Poblete', apellidoMaterno: 'Vera', rut: '11.445.566-0', telefono: '+56912345033', correo: 'xpoblete@clinica.cl', activo: true },
  { nombres: 'Ingrid Paola', apellidoPaterno: 'Meza', apellidoMaterno: 'Figueroa', rut: '12.556.677-4', telefono: '+56912345034', correo: 'imeza@clinica.cl', activo: true },
  { nombres: 'Cecilia', apellidoPaterno: 'Leiva', apellidoMaterno: 'Cortés', rut: '13.667.788-8', telefono: '+56912345035', correo: 'cleiva@clinica.cl', activo: true },
  { nombres: 'Rosana Beatriz', apellidoPaterno: 'Acevedo', apellidoMaterno: 'Núñez', rut: '14.778.899-1', telefono: '+56912345036', correo: 'racevedo@clinica.cl', activo: true },
  { nombres: 'Elena', apellidoPaterno: 'Vera', apellidoMaterno: 'Palma', rut: '15.889.900-0', telefono: '+56912345037', correo: 'evera@clinica.cl', activo: true },
  { nombres: 'Jacqueline', apellidoPaterno: 'Figueroa', apellidoMaterno: 'Uribe', rut: '7.778.889-1', telefono: '+56912345038', correo: 'jfigueroa@clinica.cl', activo: true },
  { nombres: 'Sandra Paz', apellidoPaterno: 'Cortés', apellidoMaterno: 'Tapia', rut: '8.889.990-3', telefono: '+56912345039', correo: 'scortes@clinica.cl', activo: true },
  { nombres: 'Carla', apellidoPaterno: 'Núñez', apellidoMaterno: 'Lagos', rut: '9.990.001-6', telefono: '+56912345040', correo: 'cnunez@clinica.cl', activo: true },
  // Algunas inactivas para probar el filtro
  { nombres: 'Rosa María', apellidoPaterno: 'Palma', apellidoMaterno: 'Ríos', rut: '10.001.112-3', telefono: '+56912345041', correo: 'rpalma@clinica.cl', activo: false },
  { nombres: 'Denise', apellidoPaterno: 'Uribe', apellidoMaterno: 'Orellana', rut: '11.112.223-7', telefono: '+56912345042', correo: 'duribe@clinica.cl', activo: false },
  { nombres: 'Miriam Alejandra', apellidoPaterno: 'Tapia', apellidoMaterno: 'Alvarado', rut: '12.223.334-0', telefono: '+56912345043', correo: 'mtapia@clinica.cl', activo: false },
  { nombres: 'Loreto', apellidoPaterno: 'Lagos', apellidoMaterno: 'Benavides', rut: '13.334.445-4', telefono: '+56912345044', correo: 'llagos@clinica.cl', activo: false },
  { nombres: 'Nadia Fernanda', apellidoPaterno: 'Ríos', apellidoMaterno: 'Céspedes', rut: '14.445.556-8', telefono: '+56912345045', correo: 'nrios@clinica.cl', activo: false },
  // Sin algunos datos opcionales
  { nombres: 'Alejandra', apellidoPaterno: 'Orellana', apellidoMaterno: null, rut: null, telefono: '+56912345046', correo: null, activo: true },
  { nombres: 'Beatriz', apellidoPaterno: 'Alvarado', apellidoMaterno: 'Donoso', rut: '15.556.667-1', telefono: null, correo: 'balvarado@clinica.cl', activo: true },
  { nombres: 'Carmen Gloria', apellidoPaterno: 'Benavides', apellidoMaterno: null, rut: null, telefono: null, correo: null, activo: true },
  { nombres: 'Diana', apellidoPaterno: 'Céspedes', apellidoMaterno: 'Molina', rut: '16.667.778-5', telefono: '+56912345049', correo: 'dcespedes@clinica.cl', activo: true },
  { nombres: 'Eva Soledad', apellidoPaterno: 'Donoso', apellidoMaterno: 'Arriagada', rut: '17.778.889-9', telefono: '+56912345050', correo: 'edonoso@clinica.cl', activo: true },
]

async function seed() {
  console.log('🌱 Seeding database...')

  await db.delete(nurses)
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

  await db.insert(nurses).values(nurseData)

  console.log('✅ Seed completado:')
  console.log('   admin@homelab.cl   / admin123  (rol: admin)')
  console.log('   usuario@homelab.cl / user123   (rol: usuario)')
  console.log(`   ${nurseData.length} enfermeras insertadas (${nurseData.filter(n => !n.activo).length} inactivas)`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed fallido:', err)
  process.exit(1)
})
