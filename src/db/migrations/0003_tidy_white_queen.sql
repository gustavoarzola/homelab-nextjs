CREATE TABLE "cotizacion_recargos" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_tipo_recargo" integer NOT NULL,
	"id_cotizacion" integer NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recargos_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_tipo_recargo" integer NOT NULL,
	"id_visita" integer NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotizaciones" DROP CONSTRAINT "cotizaciones_id_tipo_recargo_tipos_recargos_id_fk";
--> statement-breakpoint
ALTER TABLE "visitas" DROP CONSTRAINT "visitas_id_tipo_recargo_tipos_recargos_id_fk";
--> statement-breakpoint
ALTER TABLE "tipos_recargos" ADD COLUMN "precio" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizacion_recargos" ADD CONSTRAINT "cotizacion_recargos_id_tipo_recargo_tipos_recargos_id_fk" FOREIGN KEY ("id_tipo_recargo") REFERENCES "public"."tipos_recargos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_recargos" ADD CONSTRAINT "cotizacion_recargos_id_cotizacion_cotizaciones_id_fk" FOREIGN KEY ("id_cotizacion") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recargos_visitas" ADD CONSTRAINT "recargos_visitas_id_tipo_recargo_tipos_recargos_id_fk" FOREIGN KEY ("id_tipo_recargo") REFERENCES "public"."tipos_recargos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recargos_visitas" ADD CONSTRAINT "recargos_visitas_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cotizacion_recargos_id_cotizacion_idx" ON "cotizacion_recargos" USING btree ("id_cotizacion");--> statement-breakpoint
CREATE INDEX "recargos_visitas_id_visita_idx" ON "recargos_visitas" USING btree ("id_visita");--> statement-breakpoint
ALTER TABLE "cotizaciones" DROP COLUMN "monto_recargo";--> statement-breakpoint
ALTER TABLE "cotizaciones" DROP COLUMN "id_tipo_recargo";--> statement-breakpoint
ALTER TABLE "visitas" DROP COLUMN "monto_recargo";--> statement-breakpoint
ALTER TABLE "visitas" DROP COLUMN "id_tipo_recargo";