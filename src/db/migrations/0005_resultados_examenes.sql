CREATE TABLE "examenes_visitas_resultados" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_visita" integer NOT NULL,
	"id_examen" integer NOT NULL,
	"enviado" boolean DEFAULT false NOT NULL,
	"fecha_envio" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "resultados_enviados_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "resultados_total_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "visitas" SET
	"resultados_total_count" = (
		SELECT COUNT(*) FROM examenes_visitas ev WHERE ev.id_visita = visitas.id
	) + (
		SELECT COUNT(*) FROM examenes_isapre_visitas eiv WHERE eiv.id_visita = visitas.id
	),
	"resultados_enviados_count" = CASE WHEN resultados_enviados THEN (
		SELECT COUNT(*) FROM examenes_visitas ev WHERE ev.id_visita = visitas.id
	) + (
		SELECT COUNT(*) FROM examenes_isapre_visitas eiv WHERE eiv.id_visita = visitas.id
	) ELSE 0 END;--> statement-breakpoint
ALTER TABLE "visitas" DROP COLUMN "resultados_enviados";--> statement-breakpoint
ALTER TABLE "visitas" DROP COLUMN "fecha_envio_resultados";--> statement-breakpoint
ALTER TABLE "examenes_visitas_resultados" ADD CONSTRAINT "examenes_visitas_resultados_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_visitas_resultados" ADD CONSTRAINT "examenes_visitas_resultados_id_examen_examenes_id_fk" FOREIGN KEY ("id_examen") REFERENCES "public"."examenes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "examenes_visitas_resultados_visita_examen_idx" ON "examenes_visitas_resultados" USING btree ("id_visita","id_examen");--> statement-breakpoint
CREATE INDEX "examenes_visitas_resultados_id_visita_idx" ON "examenes_visitas_resultados" USING btree ("id_visita");
