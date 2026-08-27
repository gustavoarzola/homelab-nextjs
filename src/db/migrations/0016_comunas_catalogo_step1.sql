CREATE TABLE "comunas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "precios_visita_enfermeria_comuna_idx";--> statement-breakpoint
DROP INDEX "precios_visita_enfermeria_comuna_key";--> statement-breakpoint
ALTER TABLE "enfermeras" ADD COLUMN "id_comuna_residencia" integer;--> statement-breakpoint
ALTER TABLE "precios_visita_enfermeria" ADD COLUMN "id_comuna" integer;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "id_comuna" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "comunas_nombre_idx" ON "comunas" USING btree ("nombre");--> statement-breakpoint
ALTER TABLE "enfermeras" ADD CONSTRAINT "enfermeras_id_comuna_residencia_comunas_id_fk" FOREIGN KEY ("id_comuna_residencia") REFERENCES "public"."comunas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precios_visita_enfermeria" ADD CONSTRAINT "precios_visita_enfermeria_id_comuna_comunas_id_fk" FOREIGN KEY ("id_comuna") REFERENCES "public"."comunas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_id_comuna_comunas_id_fk" FOREIGN KEY ("id_comuna") REFERENCES "public"."comunas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "precios_visita_enfermeria_id_comuna_idx" ON "precios_visita_enfermeria" USING btree ("id_comuna");--> statement-breakpoint
CREATE UNIQUE INDEX "precios_visita_enfermeria_comuna_key" ON "precios_visita_enfermeria" USING btree ("id_comuna") WHERE "precios_visita_enfermeria"."id_comuna" IS NOT NULL;