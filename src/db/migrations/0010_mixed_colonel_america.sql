ALTER TABLE "cotizaciones" ADD COLUMN "monto_insumos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "monto_insumos" integer DEFAULT 0 NOT NULL;