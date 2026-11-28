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
CREATE INDEX "categorias_costos_id_grupo_idx" ON "categorias_costos" USING btree ("id_grupo");--> statement-breakpoint
-- Categorías iniciales del informe de fin de mes.
INSERT INTO "categorias_costos" ("nombre", "id_grupo", "orden")
SELECT c.nombre, g.id, c.orden
FROM (VALUES
	('Factura Imalab', 'Facturas laboratorio', 1),
	('Factura ELSA', 'Facturas laboratorio', 2),
	('Rinaldo · Fijo', 'Sueldo Rinaldo', 1),
	('Rinaldo · Variable por paciente', 'Sueldo Rinaldo', 2),
	('Rinaldo · Variable por producción', 'Sueldo Rinaldo', 3),
	('Rinaldo · Bono', 'Sueldo Rinaldo', 4),
	('Rinaldo · Retención', 'Sueldo Rinaldo', 5),
	('DIPROMED', 'Gastos fijos y variables sin el personal', 1),
	('Parche curita, sachet alcohol, arriendo Fantomas', 'Gastos fijos y variables sin el personal', 2),
	('Materiales / modificación sociedad / imprenta / computación', 'Gastos fijos y variables sin el personal', 3),
	('Insumos curaciones y procedimientos', 'Gastos fijos y variables sin el personal', 4),
	('Errores', 'Gastos fijos y variables sin el personal', 5),
	('Amazon', 'Gastos fijos y variables sin el personal', 6),
	('ADM Hosting', 'Gastos fijos y variables sin el personal', 7),
	('Google Ads', 'Gastos fijos y variables sin el personal', 8),
	('Contador', 'Gastos fijos y variables sin el personal', 9),
	('Electrocardiograma', 'Gastos fijos y variables sin el personal', 10),
	('Telefonía e internet', 'Gastos fijos y variables sin el personal', 11),
	('E Punto', 'Gastos fijos y variables sin el personal', 12)
) AS c(nombre, grupo, orden)
JOIN "grupos_costos" g ON g.nombre = c.grupo
ON CONFLICT ("nombre") DO NOTHING;
