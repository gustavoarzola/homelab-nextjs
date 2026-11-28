# Reporte financiero — propuesta limpia

> Parte de la necesidad, no del código actual. Lo aprendido para llegar acá está en
> [`00-aprendizajes.md`](00-aprendizajes.md). Es una propuesta: nada de esto está implementado.

## La idea en una frase

**Una sola fuente de verdad, las líneas financieras de cada visita, y tres vistas sobre ella:** el
detalle para el contador, el estado de resultados para el dueño y los indicadores. Todo se calcula;
no queda ninguna celda para completar a mano.

```
                         ┌─────────────────────────────┐
  visita + ítems ──────▶ │  lineasFinancieras(visita)  │ ──▶ costo de la visita, pago enfermera,
                         │  (función pura, 1 lugar)    │     correo, dashboard
                         └──────────────┬──────────────┘
                                        │ al completar la visita: snapshot (visita_lineas)
                                        ▼
         ┌──────────────────────┬────────────────────────┬──────────────────────┐
         │ Detalle contador     │ Estado de resultados   │ Indicadores          │
         │ (formato largo, 1:1) │ (mes, por línea de     │ (conteos, ticket,    │
         │                      │  negocio, + gastos)    │  % descuento…)       │
         └──────────────────────┴────────────────────────┴──────────────────────┘
                                        ▲
                         gastos mensuales (grupos tipados) + configuración (tasas, labs)
```

---

## 1. Núcleo: líneas financieras de la visita

Hoy la fórmula vive en cinco lugares. Se reemplaza por **una** función pura:

```ts
lineasFinancieras(visita): LineaFinanciera[]

type LineaFinanciera = {
  concepto: ConceptoId        // 'visita' | 'descuento_visita' | 'curacion' | 'descuento_curacion' | …
  monto: number               // con signo: los descuentos en negativo
  lineaNegocio: LineaNegocio  // 'visitas' | 'procedimientos' | 'examenes:imalab' | 'isapre' | 'talleres' | 'insumos' | 'no_realizada'
  baseEnfermera: boolean      // si entra a la base del pago de la enfermera
  detalle?: string            // nombre del ítem (para el contador)
}
```

- **Un catálogo de conceptos en código** (como `CONCEPTOS_INGRESO`, pero completo). Cada concepto
  trae etiqueta, naturaleza (`ingreso` | `descuento` | `informativo`), línea de negocio y nombre para
  el contador. El valor completo de isapre es `informativo`: se muestra pero no suma.
- **Todo se deriva de esas líneas:**
  - `costo` de la visita = Σ de las líneas que no son informativas;
  - pago a la enfermera = `round(Σ líneas baseEnfermera × %)`;
  - el detalle del correo;
  - el reporte.

  Los cinco cálculos actuales pasan a ser lecturas de esta función.
- **Las reglas por estado viven acá y en ningún otro lado.** No realizada produce una sola línea,
  el cobro de no realizada (base enfermera: sí). Cancelada no produce líneas.
- **El cobro de no realizada entra en `costo`.** Hoy queda fuera: `costo_traslado` es un campo
  aparte. Con esto, "lo que se cobró" es siempre Σ de las líneas.

### Snapshot al completar
Cuando una visita pasa a `completada` (ya cobrada y con documento emitido), se guardan sus líneas en
`visita_lineas`, junto con el **% de la enfermera vigente ese día**. Desde ahí:
- los meses pasados no cambian aunque cambien los precios o el % (resuelve la deuda #9);
- el reporte de meses cerrados lee del snapshot, que es rápido y estable, y el mes en curso se
  calcula en vivo;
- `/pagos-enfermeras` lee las mismas líneas, con lo que incluye las no realizadas (resuelve la deuda
  #10) y cuadra 1:1 con el reporte.

## 2. Gastos

Lo de hoy se mantiene (grupos, categorías y monto por mes) y se agregan dos cosas:

- **Tipo de grupo:** `costo_directo` (existe porque hubo visitas: laboratorios, insumos, ECG) o
  `gasto_operacional` (la estructura: personal administrativo, marketing, administración). Un grupo
  de costo directo puede asociarse a una **línea de negocio**. Por ejemplo, "Factura Imalab" →
  `examenes:imalab`. Así se calcula el margen de cada línea.
- **"Copiar mes anterior"** para los gastos recurrentes (arriendo, contador, hosting).

Los honorarios de las enfermeras **no se ingresan**: se calculan de las líneas.

## 3. Configuración (en vez de celdas amarillas)

| Hoy, celda manual | Qué es en realidad | Cómo se calcula |
|---|---|---|
| Retención Visitas | **Margen** de visitas | Producción Visitas − honorarios. Ya se calcula hoy |
| Retención Exámenes (38–42 %) | **Margen** de exámenes por laboratorio | Si el lab factura el costo: producción del lab − su factura (gasto directo asociado). Si el modelo es comisión: producción × % configurable por laboratorio. **Depende de la decisión D1** |
| Retención Impuestos Visitas | Retención de boletas de honorarios (15,25 % en 2026) que se entera en el F29 | Honorarios × tasa vigente (tabla de tasas con fecha de inicio). **Informativo:** no es un costo adicional, el costo sigue siendo el honorario bruto |
| Total Facturado | Documentos emitidos en el mes | Σ `costo` de las visitas con boleta o factura emitida en el mes. Es la vista de caja (D2) |
| Utilidad antes de gastos | Margen de contribución total | Ingresos netos − costos directos |
| Utilidad antes de impuestos | Resultado operacional | Margen de contribución − gastos operacionales |
| Insumos recuperados | **Ingreso** por insumos | Línea de ingreso como cualquier otra. Su costo (DIPROMED, etc.) va como gasto directo de la línea `insumos` |

## 4. Las tres vistas

### 4.1 Estado de resultados (página `/reportes/estado-resultados` + Excel)
Primero se ve en la app, con un botón para exportar a Excel. Columnas: meses (con un Total solo si
hay más de uno). Filas:

```
INGRESOS                                    (netos, por línea de negocio)
  Visitas de enfermería                     bruto − descuentos
  Procedimientos (curaciones / otros)       bruto − descuentos
  Recargos · Talleres
  Exámenes Imalab · Fonasa 3 · Integramédica · IMED Isapre (a pagar)
  Insumos
  Cobros de visitas no realizadas
  = Ingresos netos
COSTOS DIRECTOS
  Honorarios enfermeras                     (detalle por enfermera: desplegable / hoja aparte)
  Laboratorios (una fila por lab)           gastos de tipo costo_directo
  Insumos y otros directos
  = MARGEN DE CONTRIBUCIÓN                  total y % … y por línea de negocio (tabla aparte)
GASTOS OPERACIONALES                        por grupo (Personal, Marketing, Administración…)
  = RESULTADO ANTES DE IMPUESTO
Informativos: retención honorarios a enterar (F29) · IMED valor completo · Total facturado (caja)
```

Ejemplo de la tabla de márgenes por línea de negocio, que es lo que la planilla actual intentaba
mostrar con las "retenciones":

| Línea | Ingreso neto | Costo directo | Margen | % |
|---|---|---|---|---|
| Visitas (fee, procedimientos, recargos, talleres, no realizadas) | 16.202.820 | 10.029.289 (honorarios) | 6.173.531 | 38 % |
| Exámenes Imalab | 6.825.084 | 4.100.000 (factura) | 2.725.084 | 40 % |
| Insumos | 866.243 | 500.000 (DIPROMED) | 366.243 | 42 % |

(Cifras de la base de prueba; el costo de cada lab es inventado.)

**Avisos en la página** (los mismos que el Excel deja hoy en la columna de control):
- visitas `realizada` del mes que aún no están completadas (por cobrar), con su monto;
- visitas cuyo `costo` guardado no cuadra con sus líneas;
- gastos de grupos de costo directo en $0 cuando su línea de negocio tuvo producción (por ejemplo,
  falta la factura del lab).

### 4.2 Detalle para el contador (Excel, formato largo)
Una fila por **visita × concepto**, en vez de una fila por visita con 40 columnas:

```
Fecha | Visita | Estado | Paciente | RUT | Documento | N° | Pagado | Concepto | Línea de negocio | Ítem | Monto
```

- **Es más simple:** no se agregan columnas cuando aparece un concepto nuevo, se filtra por concepto
  y una tabla dinámica arma cualquier agrupación.
- **Cuadra igual:** Σ Monto por visita = `costo`.
- **Columnas antiguas:** se mantiene una hoja "ancha" opcional para quien quiera el formato de una
  columna por concepto. Se genera a partir del formato largo.

### 4.3 Indicadores
Van al lado del estado de resultados, no dentro de él:
- visitas por tipo, con la regla del dashboard compartida en una función `clasificarVisita()`;
- pacientes nuevos y origen de contacto;
- ticket promedio, % de descuento sobre las ventas y margen por visita;
- visitas no realizadas.

Vacunas y ECG quedan **solo si** se agregan como categorías de procedimiento. Hoy el modelo no los
distingue.

## 5. Cierre mensual

Una tabla `cierres_mensuales (anio, mes, estado, cerrado_por, cerrado_en, totales jsonb)`:
- **Cerrar el mes** congela el estado de resultados: guarda los totales y bloquea la edición de
  gastos de ese mes.
- **Reabrir** el mes es solo para admin y queda registrado.
- El estado de resultados de un mes cerrado se lee del cierre. Así se responde "¿qué le mandamos al
  contador en marzo?" aunque después se corrija algo.

## 6. Decisiones abiertas (las responde el negocio, no el código)

| # | Pregunta | Recomendación |
|---|---|---|
| D1 | ¿Cómo fluye la plata de cada laboratorio? ¿HomeLab cobra el total y el lab le factura el costo, o solo recibe una comisión? ¿Y la diferencia de isapre (valor completo − a pagar)? | Preguntar laboratorio por laboratorio. El modelo soporta los dos casos: factura como costo directo, o % configurable |
| D2 | ¿En qué mes cae una visita? ¿Por la fecha de la visita (devengado) o por la fecha de pago o del documento (caja)? | Devengado para el estado de resultados (`realizada` + `completada` por fecha de visita) y caja como informativo ("Total facturado") |
| D3 | El % de la enfermera, ¿es el monto bruto de la boleta? | Sí, según lo que se decidió en `feat/estado-resultados`. La retención es solo informativa |
| D4 | ¿Hay documentos afectos a IVA? | Todo exento (también decidido antes). Si cambia, el ingreso va neto de IVA |
| D5 | ¿El estado de resultados termina en "resultado antes de impuesto"? | Sí. El impuesto es anual y depende del régimen; como mucho, una estimación aparte |
| D6 | ¿Se mantiene la planilla de fin de mes tal cual? | No: el estado de resultados la reemplaza. La tabla de la sección 3 hace de traductor mientras tanto |

## 7. Camino desde lo que hay

Cada fase se puede liberar por separado y mantiene los tests de cuadre actuales:

1. **Núcleo de líneas.** `lineasFinancieras()` y el catálogo de conceptos, reemplazando
   `computeMontosFinancieros`. Primero el reporte actual pasa a usar la función nueva y un test
   comprueba que el Excel no cambia. Después `computeCostoVisita`, el pago a enfermeras y el correo
   pasan a derivar de ella, con tests de equivalencia contra la base sembrada.
2. **Estado de resultados calculado.** Página + Excel con la estructura de 4.1. El cobro de no
   realizada pasa a `costo`. Desaparecen las celdas amarillas. El "Resumen" actual se queda un
   tiempo, como hoy el reporte de "formato anterior".
3. **Gastos tipados.** El tipo de grupo, la asociación a una línea de negocio, "copiar mes anterior"
   y la tabla de tasas de retención con fecha de inicio. Esto requiere resolver D1.
4. **Snapshot al completar.** `visita_lineas` con el % de la enfermera. `/pagos-enfermeras` lee de
   ahí e incluye las no realizadas (deudas #9 y #10).
5. **Cierre mensual y detalle largo** para el contador.

Mejora de infraestructura que conviene hacer antes de la fase 3: que `vercel-build` migre con un
script del migrador de `drizzle-orm` que muestre el error SQL completo (ver aprendizajes, §4).
