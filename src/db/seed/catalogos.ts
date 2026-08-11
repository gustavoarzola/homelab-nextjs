import bcrypt from 'bcryptjs'
import { isNull, sql } from 'drizzle-orm'
import {
  users,
  healthInsurances,
  elderlyResidences,
  procedures,
  exams,
  contactOrigins,
  surchargeTypes,
  workshops,
  nurses,
  nursingVisitPrices,
} from '../schema'
import { previsionesData } from './data/previsiones'
import { residenciasData } from './data/residencias'
import { procedimientosData } from './data/procedimientos'
import { examenesIsapreData } from './data/examenes-isapre'
import { tiposRecargosData } from './data/tipos-recargos'
import { origenesContactoData } from './data/origenes-contacto'
import { talleresData } from './data/talleres'
import { examenesDataWithPrices } from './data/examenes-csv'
import { buildNursingVisitPrices } from './data/precios-visita'
import { nurseData, COMUNAS_RM, pickByIndex } from './data/enfermeras'

// Igual que `PricingDb` en `src/lib/pricing/visitas.ts`: la conexión puede ser
// tanto el Pool de Neon (drizzle-orm/neon-serverless) como postgres.js
// (drizzle-orm/postgres-js) según el entorno (ver `src/db/index.ts`). Se tipa
// como `any` para aceptar ambas variantes sin duplicar tipos; es deuda técnica
// conocida y ya asumida en el resto del proyecto.
type SeedConn = any

/**
 * Inserta usuarios del sistema + todos los catálogos "de verdad" (prod-safe).
 *
 * IDEMPOTENTE y NO DESTRUCTIVO: nunca trunca ni borra filas existentes. Usa
 * `onConflictDoNothing()` sobre la clave natural de cada catálogo, así que
 * puede ejecutarse repetidas veces (incluso contra una base con datos reales)
 * sin generar duplicados ni pisar filas ya presentes.
 *
 * NO usa RETURNING para IDs de catálogo: el Paso 2 (operación) los vuelve a
 * leer por clave natural cuando los necesita.
 */
export async function seedCatalogos(conn: SeedConn): Promise<void> {
  // ─── Usuarios del sistema ────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10)
  const userHash = await bcrypt.hash('user123', 10)
  console.log('   Insertando usuarios del sistema...')
  await conn
    .insert(users)
    .values([
      { nombre: 'Administrador', correo: 'admin@homelab.cl', contrasena: adminHash, rol: 'admin', activo: true },
      { nombre: 'Usuario Demo', correo: 'usuario@homelab.cl', contrasena: userHash, rol: 'usuario', activo: true },
    ])
    .onConflictDoNothing({ target: users.correo })

  // ─── Previsiones de salud ────────────────────────────────────────────────
  console.log(`   Insertando ${previsionesData.length} previsiones de salud...`)
  await conn.insert(healthInsurances).values(previsionesData).onConflictDoNothing({ target: healthInsurances.nombre })

  // ─── Residencias adulto mayor ────────────────────────────────────────────
  console.log(`   Insertando ${residenciasData.length} residencias de adulto mayor...`)
  await conn.insert(elderlyResidences).values(residenciasData).onConflictDoNothing({ target: elderlyResidences.nombre })

  // ─── Procedimientos ──────────────────────────────────────────────────────
  console.log(`   Insertando ${procedimientosData.length} procedimientos...`)
  await conn.insert(procedures).values(procedimientosData).onConflictDoNothing({ target: procedures.codigo })

  // ─── Exámenes (Imalab desde CSV + Imalab-Isapre) ────────────────────────
  console.log(`   Insertando ${examenesDataWithPrices.length} exámenes imalab...`)
  await conn.insert(exams).values(examenesDataWithPrices).onConflictDoNothing()

  console.log(`   Insertando ${examenesIsapreData.length} exámenes imalab isapre...`)
  await conn.insert(exams).values(examenesIsapreData).onConflictDoNothing()

  // ─── Orígenes de contacto ────────────────────────────────────────────────
  console.log(`   Insertando ${origenesContactoData.length} orígenes de contacto...`)
  await conn.insert(contactOrigins).values(origenesContactoData).onConflictDoNothing({ target: contactOrigins.nombre })

  // ─── Tipos de recargos ───────────────────────────────────────────────────
  console.log(`   Insertando ${tiposRecargosData.length} tipos de recargos...`)
  await conn.insert(surchargeTypes).values(tiposRecargosData).onConflictDoNothing({ target: surchargeTypes.nombre })

  // ─── Talleres ────────────────────────────────────────────────────────────
  console.log(`   Insertando ${talleresData.length} talleres...`)
  await conn.insert(workshops).values(talleresData).onConflictDoNothing({ target: workshops.codigo })

  // ─── Enfermeras ──────────────────────────────────────────────────────────
  // No hay clave natural única en `enfermeras` (rut/correo pueden ser null).
  // El correo, cuando existe, es el mejor candidato de "identidad real"; se
  // usa como target de conflicto y las filas sin correo (null) simplemente no
  // colisionan entre sí (múltiples NULL no son iguales en Postgres), por lo
  // que solo protege contra duplicar el mismo registro dos veces, no entre
  // enfermeras distintas sin correo. Es aceptable para datos de catálogo real.
  console.log(`   Insertando ${nurseData.length} enfermeras...`)
  await conn
    .insert(nurses)
    .values(
      nurseData.map((n, i) => ({
        ...n,
        rut: n.rut?.replace(/[.-]/g, '') ?? null,
        comunaResidencia: pickByIndex(COMUNAS_RM, i),
      })),
    )
    .onConflictDoNothing({ target: nurses.correo })

  // ─── Precios de visita de enfermería por comuna ─────────────────────────
  // DECISIÓN: `comuna` es nullable y la fila base (comuna = null) representa
  // el precio por defecto. Postgres no deduplica múltiples NULL con un
  // uniqueIndex normal, y `.nullsNotDistinct()` (drizzle-orm 0.45) solo existe
  // en el builder de `unique()` constraint, no en `uniqueIndex()`. Por eso:
  //   1. Las comunas con nombre usan el índice único parcial
  //      `precios_visita_enfermeria_comuna_key` (WHERE comuna IS NOT NULL) vía
  //      onConflictDoNothing con ese target.
  //   2. La fila base (comuna = null) se inserta con un chequeo de existencia
  //      previo, no con onConflictDoNothing.
  const visitPricesData = buildNursingVisitPrices()
  const [basePrice, ...comunaPrices] = visitPricesData
  console.log(`   Insertando ${visitPricesData.length} precios de visitas de enfermería...`)

  if (basePrice) {
    const [existingBase] = await conn
      .select({ id: nursingVisitPrices.id })
      .from(nursingVisitPrices)
      .where(isNull(nursingVisitPrices.comuna))
      .limit(1)
    if (!existingBase) {
      await conn.insert(nursingVisitPrices).values(basePrice)
    }
  }

  if (comunaPrices.length > 0) {
    await conn
      .insert(nursingVisitPrices)
      .values(comunaPrices)
      .onConflictDoNothing({
        target: nursingVisitPrices.comuna,
        where: sql`${nursingVisitPrices.comuna} IS NOT NULL`,
      })
  }

  console.log('   Catálogos listos (idempotente, no destructivo).')
}
