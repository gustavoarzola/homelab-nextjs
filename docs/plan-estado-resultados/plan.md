# Estado de resultados — plan y estado de implementación

> **Estado (2026-11-05):** implementado en la rama `feat/estado-resultados`, verificado en el
> navegador y con tests. El plan de abajo es el marco conceptual y las decisiones tomadas;
> donde difiere de lo implementado, manda esta nota.
>
> **Diferencias respecto al plan:**
> - El detalle por enfermera salió de la tabla del EERR (50 enfermeras la ahogaban): queda la línea
>   total y una hoja "Honorarios por enfermera" en el Excel. Los honorarios se obtienen llamando a
>   `searchPagosEnfermerasMensual` (sin extraer un helper compartido), así coinciden con `/pagos-enfermeras`.
> - Los traslados de visitas `no_realizada` son solo un indicador; no suman a ingresos (por decidir).
> - "Facturado con boleta" es un indicador, no una línea del EERR.
> - C2 (flujo de plata de exámenes "depende del laboratorio"): ingreso bruto por laboratorio y el costo de
>   cada laboratorio como gasto manual `costo_laboratorio` con su `grupo_examen`; el margen por laboratorio
>   sale correcto sea cual sea el flujo.
> - Categorías de procedimiento centralizadas en `src/lib/procedimiento-categorias.ts` (se agregó `ecg`).
>
> **Pendientes:** confirmar las tasas de retención sembradas (14,5 % 2025, 15,25 % 2026, 16 % 2027,
> 17 % 2028); decidir si el sueldo de administración se automatiza (hoy gasto manual de personal);
> crear el procedimiento de ECG en el catálogo.
>
> **Archivos clave:** `src/lib/finanzas/estado-resultados.ts` (lógica pura),
> `src/lib/actions/{estado-resultados,gastos-mensuales,tasas-retencion}.ts`,
> `src/app/(admin)/estado-resultados/page.tsx`, `src/lib/excel/build-estado-resultados-excel.ts`,
> migración `0024_estado_resultados.sql`, tests en `src/lib/finanzas/__tests__` y
> `src/lib/actions/__tests__/estado-resultados.test.ts`.

---

# Estado de Resultados mensual (EERR) — marco conceptual + plan

## Context

El backoffice Django tenía un EERR mensual en Excel (`~/Projects/homelab/web/views/reports.py::
generate_excel_report`) y una tabla de gastos manuales (`MonthlyExpense`). El Next.js no tiene ninguno
de los dos. El xlsx del cliente (`~/Downloads/Ejemplo Fin de Mes.xlsx`) es solo una plantilla de
etiquetas, sin valores, y mezcla conceptos: descuentos e insumos aparecen como gastos, y hay
retenciones en el bloque de ingresos. **Decisión del usuario: no copiar los títulos de la plantilla.**
Se arma un EERR conceptualmente correcto con el modelo nuevo, y **antes de implementar hay que
validar el marco conceptual** para no tener que rehacerlo.

---

## 1. Qué es cada bloque de un EERR (aplicado a HomeLab)

Un EERR responde a una pregunta: **en el mes, ¿cuánto se ganó por los servicios prestados?** Se
ordena en cascada, de la venta a la utilidad, y cada subtotal responde una pregunta distinta.

```
  Ingresos brutos             lo que vale lo vendido, a precio de lista
− Descuentos                  rebajas concedidas al cliente
= INGRESOS NETOS              (1) ¿cuánto vendimos?
− Costos directos             lo que cuesta producir CADA servicio (sube y baja con el volumen)
= MARGEN DE CONTRIBUCIÓN      (2) ¿cuánto deja cada línea de negocio para pagar la estructura?
− Gastos operacionales        la estructura: existe aunque haya 0 visitas
= RESULTADO OPERACIONAL       (3) ¿el negocio es rentable?
− Impuesto a la renta (est.)
= RESULTADO NETO
```

### 1.1 Ingresos (por línea de negocio)
Es todo lo que HomeLab le cobra al paciente, separado por el tipo de servicio para poder ver después
el margen de cada línea:

| Línea | Fuente |
|---|---|
| Visita de enfermería (fee) | `monto_visita_original` |
| Procedimientos | Σ `procedimientos_visitas.precio` (subtotal opcional por categoría: curaciones, vacunas, ECG…) |
| Recargos | Σ `recargos_visitas.precio` |
| Exámenes, uno por laboratorio | Σ `examenes_visitas.precio` por `grupo_examen` (imalab, imalab fonasa 3, integramédica) |
| Exámenes isapre | Σ `examenes_isapre_visitas.valor_pagar` → **ver duda C2** |
| Talleres | Σ `talleres_visitas.precio` |
| Insumos | Σ `visitas.monto_insumos`. **Es ingreso**, no un "recupero" debajo de la utilidad como en la plantilla |
| Traslados de visitas no realizadas | Σ `costo_traslado` (`estado = no_realizada`) |

### 1.2 Descuentos → se restan de los ingresos, **no son un gasto**
Un descuento es plata que nunca entró; no es algo que se pagó. La plantilla ponía "Descuento 50 %
promoción" entre los gastos, y eso infla tanto los ingresos como los gastos. En el modelo nuevo ya
están identificados: `monto_descuento` (descuento sobre el fee de visita) y
`monto_descuento_procedimientos`. `visitas.costo` ya viene neto, así que **ingresos netos =
Σ `costo`** y cuadra exacto con lo que se cobró.

> Que un descuento "afecte o no el pago a la enfermera" **no cambia el ingreso**. Solo cambia el
> costo de la enfermera (bloque 1.3): si no la afecta, HomeLab absorbe el descuento completo.

### 1.3 Costos directos (costo de ventas)
Son los costos que existen **porque hubo una visita**, y crecen en proporción a ellas:

| Costo | Fuente |
|---|---|
| Honorarios de enfermeras | `calcNursePaymentBreakdown().pago` (67,5 % de fee + procedimientos + recargos, con la reversión de descuentos) → **ver duda C1** |
| Laboratorios, uno por lab | factura mensual de cada lab (gasto manual de categoría "costo laboratorio") → **ver duda C2** |
| Insumos | compras a DIPROMED, parches, alcohol (manual, categoría "costo insumos") |
| Otros directos | ECG (arriendo del equipo), talleres si tienen costo, transporte de muestras |

**Retención de honorarios (15,25 %): no es un costo adicional.** Cuando una enfermera emite una boleta
de honorarios por $100, HomeLab le transfiere $84,75 y entera $15,25 al SII (formulario F29). El costo
para HomeLab sigue siendo $100. La retención solo divide ese costo entre dos destinatarios. Por eso
va como **dato informativo** ("retenciones por enterar en el F29"), no como una línea que reste. Si
se restara, se estaría contando dos veces. La plantilla mezclaba esto en el bloque de ingresos.

### 1.4 Margen de contribución
Ingresos netos − costos directos, en total y **por línea de negocio**: visitas+procedimientos vs. sus
honorarios, exámenes de cada lab vs. su factura, insumos vs. las compras de insumos. Es el número más
útil para decidir precios y descuentos. Lo que la plantilla llamaba "Retención Visitas" y "Retención
Exámenes" era en realidad este margen, mal nombrado.

### 1.5 Gastos operacionales (estructura)
Existen aunque no haya visitas. Se separan en sub-bloques para leerlos mejor:

| Sub-bloque | Ejemplos de la plantilla |
|---|---|
| Personal administrativo | Sueldo Rinaldo (fijo + variables + bono), sueldos de las socias |
| Marketing | Google Ads |
| Administración | contador, telefonía e internet, E Punto, Amazon/software, imprenta, trámites societarios |
| Otros | errores, ajustes |

El sueldo de Rinaldo tiene una parte variable (por paciente y por producción), pero sigue siendo
personal administrativo, no un costo directo de la visita.

### 1.6 Resultado operacional → impuesto → resultado neto
Django estimaba el impuesto como 27 % del resultado. Sirve solo de referencia, porque el impuesto real
es anual, depende del régimen (Pyme 14D = 25 %) y no se calcula mes a mes. **Propuesta: terminar en
"Resultado antes de impuesto"** y, como mucho, mostrar una estimación aparte.

### 1.7 Fuera del EERR: indicadores (KPIs)
Las cantidades (pacientes, pacientes nuevos, pacientes que llegan por la web, visitas, exámenes,
vacunas, curaciones, ECG, talleres, isapre) **no son el EERR**. Van en un panel de indicadores junto
a él, junto con métricas derivadas: ticket promedio, margen por visita y % de descuento sobre las
ventas.

---

## 2. Dudas conceptuales — respuestas

- **C1 → bruto.** El % es el monto bruto de la boleta y se configura por enfermera
  (`nurses.porcentajePago`; hoy todas tienen 65 % en producción). Costo directo =
  `calcNursePaymentBreakdown().pago`. La retención (15,25 %) es solo informativa (F29).
- **C2 → depende del laboratorio.** Falta el detalle por lab (siguiente pregunta).
- **C3 → solo `completada`** (cuadra 1:1 con `/pagos-enfermeras`). Riesgo asumido: un mes cerrado puede
  cambiar si se completa una visita atrasada. Mitigación: la página muestra un aviso con el número de
  visitas `realizada` (no completadas) de ese mes y su monto, para que se vea qué falta cerrar.
- **C4 → todo exento.** Ingreso = lo cobrado, sin separar IVA.
- **C5 → devengado** (mes de emisión de la factura del gasto), por defecto.

### Texto original de las dudas

- **C1. ¿El 67,5 % es bruto o líquido?** Si el 67,5 % es el monto bruto de la boleta, el costo es el
  67,5 % y la retención sale de ahí. Si es lo que recibe la enfermera en mano, el costo real es
  67,5 / (1 − 0,1525) ≈ 79,7 %. Es una diferencia de ~12 puntos de margen.
- **C2. ¿Cómo fluye la plata de los exámenes?** Si HomeLab cobra el examen completo y el lab le
  factura el costo, el ingreso es bruto y la factura es costo directo. Si HomeLab solo recauda para el
  lab, o el lab le paga una comisión, el ingreso es solo la comisión. En isapre (`valor_completo`
  vs `valor_pagar`), ¿la diferencia la cobra el lab directo a la isapre?
- **C3. ¿En qué mes cae cada visita? (devengado vs. caja)** El EERR se arma por devengado: la venta se
  reconoce cuando se presta el servicio. "Solo completada" exige que la visita esté pagada, y eso
  mezcla criterios: el EERR de un mes cerrado cambia cuando alguien completa una visita atrasada.
  Opción devengada: `realizada + completada` por fecha de visita, con lo no cobrado como "por cobrar"
  informativo.
- **C4. IVA.** Hay visitas con factura. Si algún documento es afecto a IVA, el ingreso tiene que ir
  neto de IVA. Si todo es exento (prestaciones de salud), no cambia nada.
- **C5. Mes de los gastos:** el de emisión de la factura (devengado) o el de pago. Se recomienda
  devengado, en coherencia con C3.

---

## 3. Impacto en el plan técnico (se ajusta una vez resueltas las dudas)

- `gastos_mensuales.categoria` pasa a la jerarquía de 1.3 y 1.5:
  `costo_laboratorio` (con el lab: `grupo_examen` o texto) · `costo_insumos` · `costo_otro` ·
  `personal` · `marketing` · `administracion` · `otros`.
- `tasas_retencion_honorarios` (con vigencia) se mantiene, solo para el informativo del F29.
- Lógica pura `src/lib/finanzas/estado-resultados.ts` → secciones 1.1 a 1.6 + KPIs 1.7. Reusa
  `calcNursePaymentBreakdown` (`src/lib/pricing/nurse-payment.ts`) y `EXAM_GRUPOS`
  (`src/lib/exam-grupos.ts`).
- Agregado por enfermera compartido con `searchPagosEnfermerasMensual`
  (`src/lib/actions/pagos-enfermeras.ts:42`) para que los honorarios cuadren con `/pagos-enfermeras`.
- La página `/estado-resultados` (EERR + KPIs + gastos del mes) y el Excel usan **la misma estructura
  de filas**, sin seguir el layout de la plantilla.
- El resto (schema/migración, CRUD de gastos con "copiar mes anterior", sidebar, CLAUDE.md) sigue
  igual que en la versión anterior del plan.

## Verificación (sin cambios en lo esencial)
- Vitest de `buildEstadoResultados`: descuento que afecta y que no afecta a la enfermera, varios
  labs + isapre, insumos y tasa por vigencia.
- Cuadratura: ingresos netos = Σ `costo` (+ traslados); honorarios = Σ pagos de `/pagos-enfermeras`
  del mismo universo; Σ líneas de ingreso − descuentos = ingresos netos.
- `/verify` E2E de la página y el xlsx; `pnpm lint && pnpm typecheck && pnpm test`.
