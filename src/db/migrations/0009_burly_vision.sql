ALTER TABLE "visitas" ALTER COLUMN "estado" SET DEFAULT 'programada';--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "concepto_no_realizada" text;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "motivo_cancelacion" text;