# Homelab - Gestión de Visitas de Enfermería

Sistema de gestión de visitas de enfermería a domicilio.

## Stack Tecnológico

- **Runtime**: Node 24 LTS
- **Frontend**: Next.js 16 + React 19 + TypeScript
- **Base de Datos**: PostgreSQL + Drizzle ORM
- **UI**: Tailwind CSS 4 + shadcn/ui (tema Neutral) + @tanstack/react-table
- **Autenticación**: Auth.js v5 (Credentials)
- **Utilidades**: sonner, lucide-react, next-themes, zod, exceljs, recharts
- **Mapas**: @vis.gl/react-google-maps
- **Drag & Drop**: @dnd-kit/core
- **Fechas**: date-fns
- **Package Manager**: pnpm 9.x

## shadcn/ui

El proyecto utiliza **shadcn/ui** con el tema Neutral. Los componentes están configurados con CSS variables para soporte completo de dark mode.

Para añadir nuevos componentes:

```bash
npx shadcn-ui@latest add <nombre-componente>
```

Los componentes se instalarán en `src/components/ui/` y estarán listos para usar en cualquier parte del proyecto.

## Configuración Local

### Requisitos Previos

- Node.js 24 LTS (recomendado usar nvm con `.nvmrc`)
- pnpm 9.x
- Docker y Docker Compose (para ejecutar PostgreSQL localmente)

### Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd homelab-nextjs

# (Opcional) Cambiar a Node 24 LTS usando nvm
nvm use

# Instalar dependencias
pnpm install

# Crear archivo .env.local basado en .env.example
cp .env.example .env.local
# Edita el archivo con tus valores reales (AUTH_SECRET, GOOGLE_MAPS_API_KEY, etc.)

# Iniciar PostgreSQL con Docker Compose
docker-compose up -d

# Generar migraciones de base de datos
pnpm db:generate

# Ejecutar migraciones
pnpm db:push

# Iniciar servidor de desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`

### Comandos Útiles

```bash
# Desarrollo
pnpm dev

# Build para producción
pnpm build
pnpm start

# Linter
pnpm lint

# Base de datos
pnpm db:generate   # Generar migraciones
pnpm db:push       # Aplicar migraciones
pnpm db:studio     # Abrir Drizzle Studio
```

### Administrador de Base de Datos

Accede a Adminer en `http://localhost:8080` con las siguientes credenciales:
- Sistema: PostgreSQL
- Servidor: postgres
- Usuario: homelab_user
- Contraseña: homelab_password
- Base de datos: homelab_db

## Estructura del Proyecto

```
src/
├── app/              # Rutas y layout de Next.js
├── db/               # Configuración de Drizzle
│   ├── schema.ts     # Definición de tablas
│   ├── index.ts      # Cliente de Drizzle
│   └── migrations/   # Migraciones generadas
├── components/       # Componentes React
├── lib/              # Utilidades y helpers
├── types/            # Tipos TypeScript
├── utils/            # Funciones utilitarias
└── hooks/            # Hooks custom
```

## Modelo de Datos

Ver `PLAN_MIGRACION.md` en el repositorio raíz para la documentación completa del modelo de datos.

Tablas principales:
- `usuarios` - Usuarios del sistema
- `enfermeras` - Profesionales de enfermería
- `pacientes` - Pacientes
- `direcciones` - Direcciones
- `visitas` - Visitas programadas (entidad central)
- `procedimientos_visitas` - Procedimientos realizados
- `examenes_visitas` - Exámenes solicitados
- Y más...

## Desarrollo

### Agregar una Migración

```bash
# Después de modificar schema.ts
pnpm db:generate

# Revisar la migración en src/db/migrations/
pnpm db:push
```

### Variables de Entorno

Consultar `.env.example` para todas las variables requeridas:

- **HOMELAB_DATABASE_URL**: Conexión PostgreSQL
- **AUTH_SECRET**: Secreto para Auth.js v5 (genera con `openssl rand -base64 33`)
- **NEXT_PUBLIC_GOOGLE_MAPS_API_KEY**: API key de Google Maps
- **RESEND_API_KEY**: API key de Resend (para emails)

## Docker

El proyecto incluye `docker-compose.yml` para ejecutar PostgreSQL y Adminer localmente.

```bash
# Ver estado de contenedores
docker ps | grep homelab

# Ver logs
docker logs homelab-postgres-nextjs
docker logs homelab-adminer

# Detener servicios
docker-compose down

# Reiniciar
docker-compose restart
```

## Notas

- Los campos en la base de datos usan convención `snake_case`
- La aplicación usa convenciones TypeScript estándar (camelCase)
- Mapeo automático entre ambas convenciones via Drizzle ORM
- Puerto PostgreSQL: 5433 (no el estándar 5432)
