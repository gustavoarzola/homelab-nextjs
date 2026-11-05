CREATE TABLE "tasas_retencion_honorarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"vigente_desde" date NOT NULL,
	"porcentaje" numeric(5, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gastos_mensuales" (
	"id" serial PRIMARY KEY NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"categoria" varchar(30) NOT NULL,
	"descripcion" varchar(200) NOT NULL,
	"monto" integer DEFAULT 0 NOT NULL,
	"grupo_examen" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tasas_retencion_honorarios_vigente_desde_idx" ON "tasas_retencion_honorarios" USING btree ("vigente_desde");--> statement-breakpoint
CREATE INDEX "gastos_mensuales_anio_mes_idx" ON "gastos_mensuales" USING btree ("anio","mes");--> statement-breakpoint
-- Calendario legal de la retención de boletas de honorarios (Ley 21.133).
-- Cada fila rige desde su fecha hasta la siguiente; se agregan filas nuevas, no se editan.
INSERT INTO "tasas_retencion_honorarios" ("vigente_desde", "porcentaje") VALUES
	('2025-01-01', 14.50),
	('2026-01-01', 15.25),
	('2027-01-01', 16.00),
	('2028-01-01', 17.00)
ON CONFLICT ("vigente_desde") DO NOTHING;
