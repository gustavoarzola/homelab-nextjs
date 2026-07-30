// Placeholder del CLI de seed modular. Se completa en el Paso 2 del plan
// (`docs/plan-seed-tests/02-seed-operacion.md`): generación determinista de
// operación (pacientes, visitas, cotizaciones, asignaciones) usando `rng.ts`.
//
// Por ahora, `seedCatalogos` ya puede invocarse directamente:
//   import { seedCatalogos } from './catalogos'
//   import { db } from '../index'
//   await seedCatalogos(db)

export { seedCatalogos } from './catalogos'
