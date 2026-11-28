# Reporte financiero — lo aprendido

Resumen de dos iteraciones sobre el mismo problema, para no volver a descubrir lo mismo:

1. **`feat/estado-resultados`** (nov-2026, abandonada). Era un EERR conceptualmente correcto, con una
   página propia y gastos mensuales en categorías fijas. Su plan sigue en esa rama
   (`docs/plan-estado-resultados/plan.md`) y vale la pena leerlo.
2. **PRs #57, #63 y #64** (en `main`). Un reporte Excel con detalle 1:1 por visita, una hoja
   "Resumen" que copia la planilla de fin de mes, y gastos mensuales con grupos y categorías
   editables.

La propuesta que integra ambas está en [`01-propuesta.md`](01-propuesta.md).

---

## 1. La necesidad, en limpio

Hay **dos lectores** con preguntas distintas, y mezclarlos complica todo:

| Lector | Pregunta | Necesita |
|---|---|---|
| **Contador** | ¿Qué se cobró, por qué concepto y con qué documento? | Detalle 1:1 con la realidad, sin agrupaciones inventadas. Cada categoría de examen por separado. Descuentos visibles. Que cuadre con `visitas.costo` |
| **Dueño / admin** | ¿Cuánto se ganó en el mes, en qué línea de negocio y en qué se gastó? | Producción por fuente y por enfermera, márgenes, gastos por grupo, utilidad. Comparar mes a mes. Que **no** haya que completar celdas a mano |

Además, la planilla de fin de mes que se usa hoy trae conceptos que en el sistema **no están
definidos**. Por eso quedaron como celdas manuales (amarillas): Total facturado, Retención exámenes,
Retención impuestos visitas, Utilidad antes de gastos y Utilidad antes de impuestos.

## 2. Hallazgos del modelo de datos

- **Los montos de una visita están repartidos.** Están `visitas.costo` (snapshot del total),
  `monto_visita_original`, `monto_descuento` (con `descuento_tipo` y `descuento_valor`), el
  `descuento` de cada línea de procedimiento, `monto_insumos`, `costo_traslado` (fuera de `costo`) y,
  para isapre, `valor_completo` (informativo) y `valor_pagar` (lo que paga el paciente).
- **La misma fórmula está implementada al menos cinco veces:** `computeCostoVisita`
  (`pricing/visitas.ts`), `calcNursePayment*` (`pricing/nurse-payment.ts`), el agregado SQL de
  `searchPagosEnfermerasMensual`, `MontosCorreo` del correo a enfermeras y `computeMontosFinancieros`
  del reporte. Hoy cuadran porque hay tests que las comparan, pero cada concepto nuevo obliga a
  tocarlas todas.
- **Dos flags deciden la base de pago de la enfermera:** `descuento_afecta_pago_enfermera` y
  `descuento_procedimientos_afecta_pago_enfermera`. Talleres, exámenes e insumos no entran en esa base.
  Por eso la "retención visitas" **no es un 35 % plano**.
- **Visita no realizada:** solo cuenta el cobro que se ingresa al marcarla (`costo_traslado`). Los
  ítems siguen asociados a la visita, pero no se hicieron. Regla de negocio: la enfermera recibe su %
  sobre ese cobro. `/pagos-enfermeras` todavía no lo hace (deuda #10).
- **El % de la enfermera no queda guardado por visita.** Si cambia, se recalculan los meses pasados
  (deuda #9).
- **Estados:** `completada` exige `pagado`. Un reporte que cuente solo `realizada` deja fuera
  justamente las visitas cobradas; eso le pasaba al reporte antiguo con su filtro por defecto. El
  dashboard cuenta `realizada` + `completada`.
- **Conteos:** el dashboard cuenta visitas por tipo, no ítems. Una visita sin ítems (convenio) cuenta
  como "Otros procedimientos". El modelo no distingue vacunas, ECG ni tratamientos (las categorías de
  procedimiento son `curaciones` y `otros`), así que esos conteos de la planilla no se pueden sacar
  sin datos nuevos.
- **Exámenes:** hay tres grupos de catálogo (Imalab, Imalab Fonasa 3, Integramédica) más Imalab
  Isapre, que va en su propia tabla. Falta saber cómo fluye la plata con cada laboratorio (si
  HomeLab cobra el total y el lab le factura, o si solo recibe una comisión). De eso depende si el
  ingreso de exámenes es bruto o es solo un margen.

## 3. Decisiones de negocio ya tomadas

- Las columnas del reporte van 1:1 con conceptos reales, con los descuentos en negativo y sumando el
  Total boleta. El valor completo de isapre aparece, pero no suma.
- Estados por defecto: realizada + completada + no realizada. Las canceladas van en $0.
- Producción Visitas = visita + curaciones + otros procedimientos + talleres + recargos + cobro de no
  realizada, todo neto. Sin insumos: esos son "Insumos recuperados".
- Retención Visitas = Producción Visitas − pago enfermeras.
- Gastos: un catálogo de grupos y categorías mantenido por el admin, montos por mes (no por visita),
  y la palabra **"gastos"**, no "costos". El sueldo variable (Rinaldo) se ingresa a mano por ahora.
  "Descuento 50 % promoción" **no es un gasto**: era una forma antigua de registrar descuentos y
  contarlo como gasto lo duplicaría.
- El reporte, los grupos y las categorías son solo para admin. Los montos mensuales los ingresa
  cualquier usuario.

**Sin decidir** (de ahí las celdas amarillas): la fórmula de la utilidad antes de gastos, qué es
exactamente "Retención exámenes" (38–42 %) y qué es "Total facturado". `feat/estado-resultados`
propuso respuestas para todas; ver la propuesta.

## 4. Lecciones técnicas y operativas

- **`drizzle-kit migrate` oculta el error SQL.** Solo termina con código 1. Para diagnosticar hay que
  reproducir el estado de la base o usar un script con el migrador de `drizzle-orm`, que sí muestra el
  error. Conviene que `vercel-build` use ese script.
- **Antes de `db-guard`, un Preview migró producción.** Pasó el 5 de noviembre con
  `feat/estado-resultados` y dejó tablas huérfanas (`gastos_mensuales`, `tasas_retencion_honorarios`)
  y una fila extra en `drizzle.__drizzle_migrations`. Eso rompió la 0027 al chocar los nombres. Se
  limpió en 0027 y 0028. Lección: antes de crear o renombrar tablas, revisar qué hay realmente en
  producción (`to_regclass`), no solo el journal.
- **Los renombres de tablas se escriben a mano.** drizzle-kit pide confirmar los renombres de forma
  interactiva. Usar `generate --custom`, ajustar el snapshot y validar con un `generate` que no
  detecte cambios.
- **Las migraciones que borran algo van protegidas:** `IF EXISTS` y abortar si hay datos (`DO $$ …
  RAISE EXCEPTION`). Probar los tres estados: como producción, con datos y base limpia.
- **Al cerrar un PR, el workflow borra sus Previews y Neon borra la rama `preview/*`.** El próximo
  Preview parte de una copia nueva de producción. Eso es útil: el Preview prueba la migración contra
  el estado real.
- **Nombrar bien desde el principio sale barato.** Cambiar "costos" por "gastos" después del merge
  costó una migración de renombre, URLs nuevas y un PR extra.
- **ExcelJS escribe los strings como texto,** así que no hay riesgo de que se interpreten como
  fórmulas. Los archivos de Excel con varias hojas y estilos por fila salen de `build-excel.ts`.
- **Lo que hizo confiable al reporte fueron los tests de cuadre:** Σ columnas = Total boleta =
  `visitas.costo`, conteos iguales a los del dashboard, y Total ingresos = Producción + insumos.
  Cualquier rediseño tiene que mantenerlos.
