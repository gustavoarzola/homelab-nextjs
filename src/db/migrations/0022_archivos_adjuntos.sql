CREATE TABLE "archivos_pacientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_paciente" integer NOT NULL,
	"key" varchar(500) NOT NULL,
	"nombre_original" varchar(255),
	"content_type" varchar(100) NOT NULL,
	"tamano" integer DEFAULT 0 NOT NULL,
	"orden" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archivos_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_visita" integer NOT NULL,
	"key" varchar(500) NOT NULL,
	"nombre_original" varchar(255),
	"content_type" varchar(100) NOT NULL,
	"tamano" integer DEFAULT 0 NOT NULL,
	"orden" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "archivos_pacientes" ADD CONSTRAINT "archivos_pacientes_id_paciente_pacientes_id_fk" FOREIGN KEY ("id_paciente") REFERENCES "public"."pacientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos_visitas" ADD CONSTRAINT "archivos_visitas_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archivos_pacientes_id_paciente_idx" ON "archivos_pacientes" USING btree ("id_paciente");--> statement-breakpoint
CREATE UNIQUE INDEX "archivos_pacientes_key_idx" ON "archivos_pacientes" USING btree ("key");--> statement-breakpoint
CREATE INDEX "archivos_visitas_id_visita_idx" ON "archivos_visitas" USING btree ("id_visita");--> statement-breakpoint
CREATE UNIQUE INDEX "archivos_visitas_key_idx" ON "archivos_visitas" USING btree ("key");--> statement-breakpoint
INSERT INTO "archivos_visitas" ("id_visita", "key", "content_type", "orden")
SELECT "id", "key_orden_medica",
       CASE WHEN "key_orden_medica" LIKE '%.png'  THEN 'image/png'
            WHEN "key_orden_medica" LIKE '%.webp' THEN 'image/webp'
            WHEN "key_orden_medica" LIKE '%.gif'  THEN 'image/gif'
            WHEN "key_orden_medica" LIKE '%.pdf'  THEN 'application/pdf'
            ELSE 'image/jpeg' END,
       1
FROM "visitas"
WHERE "key_orden_medica" IS NOT NULL AND "key_orden_medica" <> '';--> statement-breakpoint
INSERT INTO "archivos_pacientes" ("id_paciente", "key", "content_type", "orden")
SELECT "id", "key_identificacion",
       CASE WHEN "key_identificacion" LIKE '%.png'  THEN 'image/png'
            WHEN "key_identificacion" LIKE '%.webp' THEN 'image/webp'
            WHEN "key_identificacion" LIKE '%.gif'  THEN 'image/gif'
            WHEN "key_identificacion" LIKE '%.pdf'  THEN 'application/pdf'
            ELSE 'image/jpeg' END,
       1
FROM "pacientes"
WHERE "key_identificacion" IS NOT NULL AND "key_identificacion" <> '';--> statement-breakpoint
ALTER TABLE "pacientes" DROP COLUMN "key_identificacion";--> statement-breakpoint
ALTER TABLE "visitas" DROP COLUMN "key_orden_medica";