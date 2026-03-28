ALTER TABLE "contactos" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "contactos" CASCADE;--> statement-breakpoint
ALTER TABLE "pacientes" RENAME COLUMN "rut" TO "identificador";--> statement-breakpoint
ALTER TABLE "pacientes" DROP CONSTRAINT "pacientes_rut_unique";--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "tipo_identificador" varchar(20);--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "contacto_nombre" varchar(100);--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "contacto_telefono" varchar(20);--> statement-breakpoint
ALTER TABLE "pacientes" ADD COLUMN "contacto_info" text;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_identificador_unique" UNIQUE("identificador");