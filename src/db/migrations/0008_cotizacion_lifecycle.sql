-- Cleanup laboratorios if not already removed (safety from snapshot desync)
ALTER TABLE "visitas" DROP CONSTRAINT IF EXISTS "visitas_id_laboratorio_laboratorios_id_fk";--> statement-breakpoint
ALTER TABLE "visitas" DROP COLUMN IF EXISTS "id_laboratorio";--> statement-breakpoint
DROP TABLE IF EXISTS "laboratorios" CASCADE;--> statement-breakpoint

-- Cotizacion lifecycle: new columns and default
ALTER TABLE "cotizaciones" ALTER COLUMN "estado" SET DEFAULT 'creada';--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "motivo_rechazo" text;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN IF NOT EXISTS "fecha_envio" timestamp;--> statement-breakpoint

-- Data migrations: rename states to match new lifecycle
UPDATE "cotizaciones" SET "estado" = 'creada' WHERE "estado" = 'borrador';--> statement-breakpoint
UPDATE "cotizaciones" SET "estado" = 'aceptada' WHERE "estado" = 'convertida';
