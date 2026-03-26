ALTER TABLE "pacientes" ADD COLUMN "contacto_nombre" varchar(100);
ALTER TABLE "pacientes" ADD COLUMN "contacto_telefono" varchar(20);
ALTER TABLE "pacientes" ADD COLUMN "contacto_info" text;
DROP TABLE IF EXISTS "contactos";
