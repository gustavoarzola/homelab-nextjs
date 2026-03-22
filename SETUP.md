# Setup Inicial - Homelab NextJS

## Estado Actual

✅ Base del proyecto creada con:
- Next.js 14 + React 18 + TypeScript
- Drizzle ORM 0.30 + PostgreSQL
- Tailwind CSS 3 + Autoprefixer
- ESLint configurado
- Estructura de directorios lista

✅ Modelos de Drizzle creados:
- 16 tablas con todas las relaciones definidas
- Índices y restricciones configuradas
- Convención snake_case en BD, camelCase en TypeScript

✅ Docker Compose configurado:
- PostgreSQL 16 en puerto 5433 (local)
- Adminer en puerto 8080 para administración visual

## Próximos Pasos

### 1. Crear archivo .env.local

```bash
cp .env.example .env.local
```

Si está usando los valores por defecto, el archivo debe quedar así:

```
DATABASE_URL=postgresql://homelab_user:homelab_password@localhost:5433/homelab_db
NEXTAUTH_SECRET=tu-secret-aleatorio-aqui
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-api-key-aqui
RESEND_API_KEY=tu-resend-key-aqui
```

### 2. Inicializar base de datos

```bash
# Generar migraciones iniciales
pnpm db:generate

# Aplicar migraciones
pnpm db:push
```

### 3. Iniciar servidor de desarrollo

```bash
pnpm dev
```

La aplicación estará en `http://localhost:3000`

### 4. Verificar Base de Datos

Accede a Adminer: `http://localhost:8080`
- Sistema: PostgreSQL
- Servidor: postgres
- Usuario: homelab_user
- Contraseña: homelab_password
- Base de datos: homelab_db

## Estructura de Carpetas

```
src/
├── app/                 # Rutas y layouts de Next.js (App Router)
├── db/                  # Configuración de Drizzle
│   ├── schema.ts        # Definición de todas las tablas
│   ├── index.ts         # Cliente de Drizzle
│   └── migrations/      # Migraciones generadas (no editar manualmente)
├── components/          # Componentes React
├── lib/                 # Utilidades
├── types/               # Tipos TypeScript
├── utils/               # Funciones de ayuda
└── hooks/               # Hooks personalizados
```

## Notas Importantes

- **Convención de base de datos**: `snake_case` (ej: `id_paciente`)
- **Convención TypeScript**: `camelCase` (ej: `idPaciente`)
- **Mapeo automático**: Drizzle ORM maneja la conversión automáticamente
- **Puerto PostgreSQL**: 5433 (no el estándar 5432, que está en uso)

## Comandos Útiles

```bash
# Desarrollo
pnpm dev

# Build
pnpm build
pnpm start

# Base de datos
pnpm db:generate       # Generar migraciones después de cambios en schema
pnpm db:push          # Aplicar migraciones a la BD
pnpm db:studio        # Abrir interfaz visual de Drizzle Studio

# Linter
pnpm lint
```

## Docker

```bash
# Ver status de contenedores
docker ps | grep homelab

# Ver logs
docker logs homelab-postgres-nextjs
docker logs homelab-adminer

# Detener servicios
docker-compose down

# Reiniciar
docker-compose restart
```

## Próximo Sprint: Funcionalidades

Una vez que la base de datos esté lista, construir:

1. Módulo de Autenticación (NextAuth v4)
2. CRUD de Pacientes
3. CRUD de Enfermeras
4. Gestión de Visitas
5. Sistema de permisos (Admin vs Usuario)
6. Integración con Google Maps
7. Exportación Excel
8. Emails con Resend

Ver `PLAN_MIGRACION.md` para detalles completos del modelo de datos.
