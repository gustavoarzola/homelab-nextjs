ALTER TABLE "cotizacion_procedimientos" ADD COLUMN "descuento" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "monto_descuento_procedimientos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "descuento_procedimientos_afecta_pago_enfermera" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "procedimientos_visitas" ADD COLUMN "descuento" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "monto_descuento_procedimientos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "descuento_procedimientos_afecta_pago_enfermera" boolean DEFAULT false NOT NULL;