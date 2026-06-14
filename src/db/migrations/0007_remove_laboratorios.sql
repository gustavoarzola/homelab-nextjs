ALTER TABLE "visitas" DROP CONSTRAINT IF EXISTS "visitas_id_laboratorio_laboratorios_id_fk";--> statement-breakpoint
ALTER TABLE "visitas" DROP COLUMN IF EXISTS "id_laboratorio";--> statement-breakpoint
DROP TABLE IF EXISTS "laboratorios";
