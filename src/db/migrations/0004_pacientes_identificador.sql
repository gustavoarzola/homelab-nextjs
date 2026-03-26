ALTER TABLE "pacientes" ADD COLUMN "identificador" varchar(200);
ALTER TABLE "pacientes" ADD COLUMN "tipo_identificador" varchar(20);
UPDATE "pacientes" SET "identificador" = "rut", "tipo_identificador" = 'rut' WHERE "rut" IS NOT NULL;
ALTER TABLE "pacientes" DROP COLUMN "rut";
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_identificador_unique" UNIQUE("identificador");
