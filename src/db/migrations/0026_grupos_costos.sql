CREATE TABLE "grupos_costos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "grupos_costos_nombre_idx" ON "grupos_costos" USING btree ("nombre");--> statement-breakpoint
-- Grupos iniciales (estructura del informe de fin de mes). Editables desde /grupos-costos.
INSERT INTO "grupos_costos" ("nombre", "orden") VALUES
	('Facturas laboratorio', 1),
	('Sueldo Rinaldo', 2),
	('Gastos fijos y variables sin el personal', 3);
--> statement-breakpoint
ALTER TABLE "categorias_costos" ADD COLUMN "id_grupo" integer;--> statement-breakpoint
ALTER TABLE "categorias_costos" ADD COLUMN "orden" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Categorías creadas antes de existir los grupos: quedan en "Gastos fijos…", al final.
UPDATE "categorias_costos"
	SET "id_grupo" = (SELECT "id" FROM "grupos_costos" WHERE "nombre" = 'Gastos fijos y variables sin el personal'),
	    "orden" = 100;
--> statement-breakpoint
ALTER TABLE "categorias_costos" ALTER COLUMN "id_grupo" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categorias_costos" ADD CONSTRAINT "categorias_costos_id_grupo_grupos_costos_id_fk" FOREIGN KEY ("id_grupo") REFERENCES "public"."grupos_costos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categorias_costos_id_grupo_idx" ON "categorias_costos" USING btree ("id_grupo");
