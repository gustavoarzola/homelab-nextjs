CREATE TABLE "examenes_isapre_cotizaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_cotizacion" integer NOT NULL,
	"id_examen" integer NOT NULL,
	"descripcion" varchar(255) NOT NULL,
	"codigo" varchar(50),
	"valor_completo" integer DEFAULT 0 NOT NULL,
	"valor_pagar" integer DEFAULT 0 NOT NULL,
	"id_prevision" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "examenes_isapre_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_visita" integer NOT NULL,
	"id_examen" integer NOT NULL,
	"valor_completo" integer DEFAULT 0 NOT NULL,
	"valor_pagar" integer DEFAULT 0 NOT NULL,
	"id_prevision" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "examenes_isapre_cotizaciones" ADD CONSTRAINT "examenes_isapre_cotizaciones_id_cotizacion_cotizaciones_id_fk" FOREIGN KEY ("id_cotizacion") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_isapre_cotizaciones" ADD CONSTRAINT "examenes_isapre_cotizaciones_id_examen_examenes_id_fk" FOREIGN KEY ("id_examen") REFERENCES "public"."examenes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_isapre_cotizaciones" ADD CONSTRAINT "examenes_isapre_cotizaciones_id_prevision_companias_seguros_id_fk" FOREIGN KEY ("id_prevision") REFERENCES "public"."companias_seguros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_isapre_visitas" ADD CONSTRAINT "examenes_isapre_visitas_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_isapre_visitas" ADD CONSTRAINT "examenes_isapre_visitas_id_examen_examenes_id_fk" FOREIGN KEY ("id_examen") REFERENCES "public"."examenes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_isapre_visitas" ADD CONSTRAINT "examenes_isapre_visitas_id_prevision_companias_seguros_id_fk" FOREIGN KEY ("id_prevision") REFERENCES "public"."companias_seguros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "examenes_isapre_cotizaciones_id_cotizacion_idx" ON "examenes_isapre_cotizaciones" USING btree ("id_cotizacion");--> statement-breakpoint
CREATE INDEX "examenes_isapre_visitas_id_visita_idx" ON "examenes_isapre_visitas" USING btree ("id_visita");