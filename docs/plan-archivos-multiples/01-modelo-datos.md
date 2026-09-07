# Paso 1 — Modelo de datos

**Objetivo**: reemplazar las columnas de archivo único (`visitas.key_orden_medica`,
`pacientes.key_identificacion`) por dos tablas de adjuntos con orden y metadata, migrando los
datos existentes.

Depende de: nada. Habilita: pasos 3, 5, 6, 7.

## 1.1 Esquema — `src/db/schema.ts`

Agregar después de la tabla `visits` (y sus relaciones) y después de `patients` /
`patientPhones` respectivamente. Seguir el estilo de `patientPhones` (`schema.ts:149-166`) y
`visitExams`.

```ts
export const visitFiles = pgTable(
  'archivos_visitas',
  {
    id: serial('id').primaryKey(),
    idVisita: integer('id_visita').notNull(),
    key: varchar('key', { length: 500 }).notNull(),
    nombreOriginal: varchar('nombre_original', { length: 255 }),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    tamano: integer('tamano').notNull().default(0),
    orden: integer('orden').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idVisita], foreignColumns: [visits.id] }).onDelete('cascade'),
    index('archivos_visitas_id_visita_idx').on(table.idVisita),
    uniqueIndex('archivos_visitas_key_idx').on(table.key),
  ],
)

export const patientFiles = pgTable(
  'archivos_pacientes',
  {
    id: serial('id').primaryKey(),
    idPaciente: integer('id_paciente').notNull(),
    key: varchar('key', { length: 500 }).notNull(),
    nombreOriginal: varchar('nombre_original', { length: 255 }),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    tamano: integer('tamano').notNull().default(0),
    orden: integer('orden').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idPaciente], foreignColumns: [patients.id] }).onDelete('cascade'),
    index('archivos_pacientes_id_paciente_idx').on(table.idPaciente),
    uniqueIndex('archivos_pacientes_key_idx').on(table.key),
  ],
)
```

**Quitar** de `schema.ts`:
- `keyOrdenMedica: varchar('key_orden_medica', { length: 500 })` de `visits` (`:312`).
- `keyIdentificacion: varchar('key_identificacion', { length: 500 })` de `patients` (`:132`).

Si hay bloques `relations()` en el archivo, agregar `visitFiles` / `patientFiles` a las
relaciones de `visits` / `patients` (revisar si el proyecto los usa; hoy `schema.ts` parece
solo definir tablas — si es así, omitir).

## 1.2 Migración

El repo numera migraciones a 4 dígitos; las de varios pasos usan sufijo descriptivo (ver
`0016_comunas_catalogo_step1.sql` … `0018_*_step2.sql`). Generar con:

```
pnpm db:generate
```

Eso crea la migración de `CREATE TABLE` + `DROP COLUMN`. **Editar el `.sql` generado** para
insertar el backfill **entre** los `CREATE TABLE` y los `DROP COLUMN`:

```sql
--> statement-breakpoint
INSERT INTO "archivos_visitas" ("id_visita", "key", "content_type", "orden")
SELECT id, key_orden_medica,
       CASE WHEN key_orden_medica LIKE '%.png'  THEN 'image/png'
            WHEN key_orden_medica LIKE '%.webp' THEN 'image/webp'
            WHEN key_orden_medica LIKE '%.gif'  THEN 'image/gif'
            WHEN key_orden_medica LIKE '%.pdf'  THEN 'application/pdf'
            ELSE 'image/jpeg' END,
       1
FROM "visitas"
WHERE key_orden_medica IS NOT NULL AND key_orden_medica <> '';
--> statement-breakpoint
INSERT INTO "archivos_pacientes" ("id_paciente", "key", "content_type", "orden")
SELECT id, key_identificacion,
       CASE WHEN key_identificacion LIKE '%.png'  THEN 'image/png'
            WHEN key_identificacion LIKE '%.webp' THEN 'image/webp'
            WHEN key_identificacion LIKE '%.gif'  THEN 'image/gif'
            WHEN key_identificacion LIKE '%.pdf'  THEN 'application/pdf'
            ELSE 'image/jpeg' END,
       1
FROM "pacientes"
WHERE key_identificacion IS NOT NULL AND key_identificacion <> '';
--> statement-breakpoint
```

Los `DROP COLUMN "key_orden_medica"` / `DROP COLUMN "key_identificacion"` van después.

Las keys migradas conservan su nombre UUID actual; el paso 7 las renombra a la convención
legible.

## 1.3 Verificación

```
pnpm db:migrate           # contra DB local (Docker)
```
En `psql`:
```sql
SELECT count(*) FROM archivos_visitas;    -- == count de visitas con key_orden_medica previa
SELECT count(*) FROM archivos_pacientes;  -- idem pacientes
\d archivos_visitas                       -- FK cascade, unique(key), index(id_visita)
\d visitas                                -- ya NO aparece key_orden_medica
```

`pnpm build` debe fallar en los sitios que aún referencian `keyOrdenMedica` /
`keyIdentificacion` (`visitas.ts`, `pacientes.ts`, `visita-form.tsx`, `paciente-form.tsx`,
`visitas-asignacion-email.ts`, `pacientes/[id]/page.tsx`, `visitas/[id]/editar/page.tsx`). Esos
se resuelven en los pasos 4–6; está bien dejar el árbol sin compilar entre pasos, pero anotar
la lista.
