ALTER TABLE "cotizaciones" ADD COLUMN "descuento_tipo" varchar(20) DEFAULT 'monto' NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "descuento_valor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "monto_descuento" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "monto_visita_original" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "descuento_afecta_pago_enfermera" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "descuento_tipo" varchar(20) DEFAULT 'monto' NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "descuento_valor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "monto_descuento" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "monto_visita_original" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "descuento_afecta_pago_enfermera" boolean DEFAULT false NOT NULL;