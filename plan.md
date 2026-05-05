# Plan de Desarrollo — Homelab Platform

> Documento de referencia para revisar y discutir antes de iniciar el desarrollo.
> Todos los cambios se harán en un branch separado de `main`.

---

## Resumen de Brechas Identificadas

Al comparar el documento operacional con el sistema actual, se encontraron estas brechas principales:

| Brecha | Impacto | Prioridad |
|--------|---------|-----------|
| Sin cotización automática de exámenes | Errores de cobro, dependencia manual | CRITICO |
| Sin control de estado de pagos | Sin trazabilidad financiera | ALTO |
| Sin control de envío de resultados | Omisiones operativas | ALTO |
| Dashboard solo muestra conteos, no montos | Sin visibilidad financiera | MEDIO |

---

## Módulo 1 — Extensión del Schema (prerequisito)

Todos los demás módulos dependen de que estos cambios estén aplicados primero.

### Tablas nuevas

#### `precios_examenes`
Almacena el precio de cada examen según el tipo de previsión del paciente y opcionalmente la comuna.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | serial PK | |
| id_examen | FK → examenes | |
| tipo_prevision | varchar | 'fonasa' \| 'isapre' \| 'particular' |
| comuna | varchar (nullable) | Si null, aplica a todas las comunas |
| precio | integer | Precio en pesos CLP |
| activo | boolean | |

**Lógica de precedencia:** Si existe un registro con `(id_examen, tipo_prevision, comuna_específica)` se usa ese. Si no, se usa el registro con `(id_examen, tipo_prevision, null)`.

> **Punto a discutir:** ¿Los precios de exámenes varían por comuna? Si no, la columna `comuna` siempre será null y se puede simplificar el diseño.

#### `precios_visita_enfermeria`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | serial PK | |
| comuna | varchar | area_administrativa_3 del paciente |
| precio | integer | Valor de la visita en esa comuna |
| activo | boolean | |

### Campos nuevos en tabla `visitas`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| pagado | boolean default false | Estado de pago |
| metodo_pago | varchar(30) nullable | 'transferencia' \| 'cheque' \| 'efectivo' |
| fecha_pago | date nullable | Cuándo se recibió el pago |
| resultados_enviados | boolean default false | Si se enviaron resultados al paciente |
| fecha_envio_resultados | date nullable | Cuándo se enviaron los resultados |
| costo_traslado | integer default 0 | Cobro cuando visita no se realizó ($7.000) |

> **Punto a discutir:** Estado `'no_realizada'` — ¿se agrega como un nuevo estado válido en el campo `estado` existente, o se prefiere mantenerlo como `'cancelada'` y usar el campo `costo_traslado > 0` como indicador?

### Campo nuevo en tabla `enfermeras`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| porcentaje_pago | numeric(5,2) default 67.5 | % del valor de visita que se paga a la enfermera |

---

## Módulo 2 — Cotización Automática

### Qué hace
Cuando se seleccionan exámenes al crear/editar una visita, el sistema calcula automáticamente el costo total sin intervención manual.

### Flujo
1. Usuario selecciona exámenes en el formulario de visita
2. El sistema obtiene:
   - Previsión del paciente (Fonasa / Isapre / Particular)
   - Comuna del paciente
3. Para cada examen seleccionado: busca su precio en `precios_examenes`
4. Suma el precio de visita de enfermería desde `precios_visita_enfermeria`
5. Auto-rellena el campo "Costo" con el total calculado
6. Muestra un desglose debajo del campo (visible, editable si necesario)

### Nuevas pantallas
- `/precios/examenes` — CRUD de precios de exámenes (carga desde Excel)
- `/precios/visitas` — CRUD de precios de visita por comuna

> **Punto a discutir:** ¿Se necesita importar los precios desde el Excel actual? Si sí, ¿se adjunta el Excel para construir una vista de importación, o se ingresa manualmente en la interfaz?

---

## Módulo 3 — Control de Pagos y Resultados

### Cambios en el formulario de visita
Nueva sección al editar una visita:

```
─── Pago y resultados ───────────────────────────────────
[✓] Pagado      Método: [Transferencia ▾]    Fecha: [15/04/2025]
[ ] Resultados enviados   Fecha envío: [___]
─────────────────────────────────────────────────────────
```

- Los campos de método/fecha de pago solo aparecen al marcar "Pagado"
- Si estado = `'no_realizada'`: aparece campo "Costo traslado" (default $7.000)

### Cambios en la tabla de visitas
- Badge visual de pago: $ verde (pagado) / $ rojo (pendiente)
- Badge de resultados: sobre verde (enviado) / sobre amarillo (pendiente)
- Filtros adicionales: "Pendientes de pago" y "Resultados por enviar"

> **Punto a discutir:** ¿La enfermera puede marcar la visita como pagada desde alguna vista propia, o solo el ejecutivo puede hacerlo?

---

## Módulo 4 — Dashboard Financiero

### Nuevas métricas en el dashboard

**Tarjetas resumen (parte superior):**
- Total facturado en el mes (suma de `costo` en visitas realizadas)
- Cobros pendientes (visitas realizadas sin pago)
- Costo traslados del mes

**Tablas de acción rápida:**
- "Cobros pendientes" — lista de visitas realizadas sin pago con link directo
- "Resultados por enviar" — lista de visitas sin resultados enviados

**Ranking de enfermeras extendido:**
- Agrega columna de "Pago estimado" (suma visitas × porcentaje_pago de cada enfermera)

> **Punto a discutir:** ¿Se necesita algún reporte exportable a Excel o PDF, o por ahora es solo visual en el dashboard?

---

## Orden de Implementación

```
Branch: feature/funcionalidades-faltantes

Paso 1: Schema + migración (Módulo 1) ← prereq de todo
    ↓
Paso 2: Cotización automática (Módulo 2)
Paso 3: Control de pagos y resultados (Módulo 3)   ← en paralelo con 2
Paso 4: Dashboard financiero (Módulo 4)             ← en paralelo con 2 y 3
```

---

## Puntos Pendientes de Discusión

1. **Precios de exámenes por comuna** — ¿varían o son uniformes por previsión?
2. **Importación de Excel de precios** — ¿se adjunta el archivo para construir importador?
3. **Estado 'no_realizada'** — ¿nuevo estado o flag por `costo_traslado > 0`?
4. **Rol de la enfermera** — ¿puede marcar pagos o solo el ejecutivo?
5. **Exportación de reportes** — ¿Excel/PDF o solo visual?
