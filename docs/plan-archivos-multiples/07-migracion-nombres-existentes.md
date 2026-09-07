# Paso 7 — Renombrar archivos existentes + limpieza

**Objetivo**: llevar las keys heredadas (UUID plano, backfilleadas en el paso 1) a la
convención legible, y cerrar dos cabos sueltos de seguridad/higiene.

Depende de: pasos 3, 5.

## 7.1 Script one-off — `src/db/scripts/renombrar-archivos.ts`

Patrón del repo: `tsx --env-file=.env.local <archivo>` (ver `db:seed` en `package.json`).
Agregar script en `package.json`:
```json
"archivos:renombrar": "tsx --env-file=.env.local src/db/scripts/renombrar-archivos.ts"
```

Lógica:
```ts
import { db } from '@/db'
import { visitFiles, patientFiles, visits } from '@/db/schema'
import { syncArchivosVisita, syncArchivosPaciente } from '@/lib/archivos/sync'

const idsVisita = [...new Set((await db.selectDistinct({ id: visitFiles.idVisita }).from(visitFiles)).map(r => r.id))]
for (const id of idsVisita) {
  try { await syncArchivosVisita(id); console.log(`visita ${id} ok`) }
  catch (e) { console.error(`visita ${id} FALLÓ`, e) }
}
// idem patientFiles / syncArchivosPaciente
```

`syncArchivosVisita` ya hace `copy` + `delete` + `update` de la `key` en DB. Idempotente: si la
key ya está en la convención, `planRenames` devuelve `[]` y no toca nada. Se puede correr varias
veces.

Correr **una vez por entorno** (local, y luego producción tras el deploy):
```
pnpm archivos:renombrar
```

Verificar en R2 (o vía `getSignedUrl` + fetch) que un par de objetos migrados quedaron como
`visitas/v{id}_{nombre}_1.jpg` y que los UUID viejos ya no existen. Revisar el log por fallos
(p.ej. una `key` en DB que apunta a un objeto inexistente en R2 — anotar y decidir si se borra
la fila).

## 7.2 `src/app/api/r2-file/route.ts` — validar prefijo

Hoy firma **cualquier** key del bucket para cualquier sesión válida. Restringir:
```ts
const key = req.nextUrl.searchParams.get('key')
if (!key || !/^(pacientes|visitas)\//.test(key)) {
  return new NextResponse('Invalid key', { status: 400 })
}
```
(El endpoint no tiene usos reales en el código —las signed URLs se generan en server
components— pero está expuesto; dejarlo acotado.)

## 7.3 Barrido de huérfanos en `tmp/` (opcional)

Las subidas quedan en `tmp/{uuid}.ext` hasta que el form se guarda (paso 5 las mueve). Si el
usuario cancela el formulario, el objeto queda en `tmp/`. Opciones (elegir una, no bloqueante):
- **Lifecycle rule en el bucket R2**: expirar objetos con prefijo `tmp/` a los 7 días
  (configuración de Cloudflare, sin código). **Preferida.**
- Script `archivos:limpiar-tmp` análogo al de renombrado que liste `tmp/` y borre lo más viejo
  que N días.

Documentar la decisión en `CLAUDE.md` (sección "Archivos y Storage (R2)").

## 7.4 Actualizar `CLAUDE.md`

- Sección "Base de Datos → Tablas pivote": agregar `archivos_visitas` / `archivos_pacientes`.
- Sección "Archivos y Storage (R2)": describir el nuevo flujo (compresión en cliente, staging
  en `tmp/`, keys legibles `v{id}_…` / `p{id}_…`, múltiples archivos por entidad).
- Sección "Email": nota de que se adjuntan todos los archivos de la visita con nombre legible.
- Quitar de "Deuda Técnica" el punto 3 si aplica; agregar nota del renombrado ya hecho.

## 7.5 Memoria del proyecto

Crear `project_archivos_adjuntos.md` en la carpeta de memoria: modelo (`archivos_visitas` /
`archivos_pacientes`), convención de key `v{id}_{nombre}_{n}.ext`, compresión en cliente
(`src/lib/images/resize.ts`), `syncArchivos*` como fuente de verdad del nombre en R2, y que el
correo adjunta todo. Enlazar `[[project_visita_lifecycle]]` y `[[project_marca_documentos]]`.
