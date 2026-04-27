CREATE TABLE "precios_examenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_examen" integer NOT NULL,
	"tipo_prevision" varchar(20) NOT NULL,
	"comuna" varchar(200),
	"precio" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precios_visita_enfermeria" (
	"id" serial PRIMARY KEY NOT NULL,
	"comuna" varchar(200) NOT NULL,
	"precio" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enfermeras" ADD COLUMN "porcentaje_pago" numeric(5, 2) DEFAULT '67.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "pagado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "metodo_pago" varchar(30);--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "fecha_pago" date;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "resultados_enviados" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "fecha_envio_resultados" date;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "costo_traslado" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "precios_examenes" ADD CONSTRAINT "precios_examenes_id_examen_examenes_id_fk" FOREIGN KEY ("id_examen") REFERENCES "public"."examenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "precios_examenes_examen_prevision_idx" ON "precios_examenes" USING btree ("id_examen","tipo_prevision","comuna");--> statement-breakpoint
CREATE INDEX "precios_visita_enfermeria_comuna_idx" ON "precios_visita_enfermeria" USING btree ("comuna");