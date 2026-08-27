import bcrypt from 'bcryptjs'
import { asc, isNull, sql } from 'drizzle-orm'
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
  comunas,
} from '../schema'
import { previsionesData } from './data/previsiones'
import { residenciasData } from './data/residencias'
import { procedimientosData } from './data/procedimientos'
import { tiposRecargosData } from './data/tipos-recargos'
import { origenesContactoData } from './data/origenes-contacto'
import { talleresData } from './data/talleres'
import { comunasData } from './data/comunas'
import { examenesDataWithPrices, examenesIsapreData } from './data/examenes-csv'
import { buildNursingVisitPrices } from './data/precios-visita'
import { nurseData, pickByIndex } from './data/enfermeras'

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

  // ─── Comunas ─────────────────────────────────────────────────────────────
  // Se inserta antes que enfermeras/precios de visita: ambos necesitan
  // resolver nombre → id contra este catálogo.
  console.log(`   Insertando ${comunasData.length} comunas...`)
  await conn.insert(comunas).values(comunasData).onConflictDoNothing({ target: comunas.nombre })
  const comunaRows: { id: number; nombre: string }[] = await conn
    .select({ id: comunas.id, nombre: comunas.nombre })
    .from(comunas)
    .orderBy(asc(comunas.nombre))
  const idComunaPorNombre = new Map(comunaRows.map((c) => [c.nombre, c.id]))

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
  // El correo, cuando existe, es el candidato de "identidad real" (índice
  // `enfermeras_correo_idx`). Para las filas sin correo, un índice parcial
  // adicional (`enfermeras_nombre_sin_correo_idx`) usa nombres+apellidos como
  // respaldo. Sin `target` explícito, DO NOTHING evalúa el conflicto contra
  // cualquiera de los dos índices (comportamiento estándar de Postgres).
  console.log(`   Insertando ${nurseData.length} enfermeras...`)
  await conn
    .insert(nurses)
    .values(
      nurseData.map((n, i) => ({
        ...n,
        rut: n.rut?.replace(/[.-]/g, '') ?? null,
        idComunaResidencia: pickByIndex(comunaRows, i).id,
      })),
    )
    .onConflictDoNothing()

  // ─── Precios de visita de enfermería por comuna ─────────────────────────
  // DECISIÓN: `idComuna` es nullable y la fila base (idComuna = null) representa
  // el precio por defecto. Postgres no deduplica múltiples NULL con un
  // uniqueIndex normal, y `.nullsNotDistinct()` (drizzle-orm 0.45) solo existe
  // en el builder de `unique()` constraint, no en `uniqueIndex()`. Por eso:
  //   1. Las comunas con id usan el índice único parcial
  //      `precios_visita_enfermeria_comuna_key` (WHERE id_comuna IS NOT NULL) vía
  //      onConflictDoNothing con ese target.
  //   2. La fila base (idComuna = null) se inserta con un chequeo de existencia
  //      previo, no con onConflictDoNothing.
  const visitPricesData = buildNursingVisitPrices()
    .map(({ comuna, precio }) => ({
      idComuna: comuna ? idComunaPorNombre.get(comuna) ?? null : null,
      precio,
    }))
    // Si algún nombre de `buildNursingVisitPrices()` no matchea el catálogo
    // (no debería pasar: usa un subconjunto de las 52 comunas de la RM), se
    // descarta en vez de colapsarlo silenciosamente contra la fila base.
    .filter((row, i) => row.idComuna !== null || i === 0)
  const [basePrice, ...comunaPrices] = visitPricesData
  console.log(`   Insertando ${visitPricesData.length} precios de visitas de enfermería...`)

  if (basePrice) {
    const [existingBase] = await conn
      .select({ id: nursingVisitPrices.id })
      .from(nursingVisitPrices)
      .where(isNull(nursingVisitPrices.idComuna))
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
        target: nursingVisitPrices.idComuna,
        where: sql`${nursingVisitPrices.idComuna} IS NOT NULL`,
      })
  }

  console.log('   Catálogos listos (idempotente, no destructivo).')
}
