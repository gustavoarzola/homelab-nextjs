CREATE TABLE "direcciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"direccion" varchar(200) NOT NULL,
	"direccion_formateada" varchar(200) DEFAULT '',
	"numero" varchar(20),
	"calle" varchar(200),
	"localidad" varchar(200),
	"area_administrativa_1" varchar(200),
	"area_administrativa_2" varchar(200),
	"area_administrativa_3" varchar(200),
	"pais" varchar(50),
	"latitud" numeric(20, 18),
	"longitud" numeric(20, 18),
	"informacion_adicional" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sucursales" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"id_laboratorio" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "origenes_contacto" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contactos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(50) NOT NULL,
	"telefono" varchar(20),
	"informacion_adicional" text,
	"id_paciente" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contactos_id_paciente_unique" UNIQUE("id_paciente")
);
--> statement-breakpoint
CREATE TABLE "residencias_adulto_mayor" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "examenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companias_seguros" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "laboratorios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enfermeras" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombres" varchar(200) NOT NULL,
	"apellido_paterno" varchar(200) NOT NULL,
	"apellido_materno" varchar(200) DEFAULT '',
	"rut" varchar(200),
	"telefono" varchar(20),
	"correo" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telefonos_pacientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"telefono" varchar(20) NOT NULL,
	"descripcion" varchar(50),
	"id_paciente" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pacientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"rut" varchar(200),
	"nombres" varchar(200) NOT NULL,
	"apellido_paterno" varchar(200) DEFAULT '',
	"apellido_materno" varchar(200) DEFAULT '',
	"fecha_nacimiento" date,
	"correo" varchar(100),
	"informacion_adicional" text,
	"id_direccion" integer NOT NULL,
	"id_compania_seguro" integer,
	"id_residencia_adulto" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pacientes_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint
CREATE TABLE "procedimientos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"correo" varchar(100) NOT NULL,
	"contrasena" varchar(255) NOT NULL,
	"rol" varchar(50) DEFAULT 'usuario' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
CREATE TABLE "examenes_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_examen" integer NOT NULL,
	"id_sucursal" integer,
	"id_visita" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedimientos_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_procedimiento" integer NOT NULL,
	"id_visita" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" date NOT NULL,
	"hora" time,
	"estado" varchar(40) DEFAULT 'creada' NOT NULL,
	"costo" integer DEFAULT 0 NOT NULL,
	"id_paciente" integer,
	"id_enfermera" integer,
	"id_sucursal" integer,
	"numero_boleta" varchar(20) DEFAULT '',
	"tipo_documento" varchar(20) DEFAULT '',
	"origen_contacto" varchar(100),
	"informacion_adicional" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_id_laboratorio_laboratorios_id_fk" FOREIGN KEY ("id_laboratorio") REFERENCES "public"."laboratorios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_id_paciente_pacientes_id_fk" FOREIGN KEY ("id_paciente") REFERENCES "public"."pacientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telefonos_pacientes" ADD CONSTRAINT "telefonos_pacientes_id_paciente_pacientes_id_fk" FOREIGN KEY ("id_paciente") REFERENCES "public"."pacientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_id_direccion_direcciones_id_fk" FOREIGN KEY ("id_direccion") REFERENCES "public"."direcciones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_visitas" ADD CONSTRAINT "examenes_visitas_id_examen_examenes_id_fk" FOREIGN KEY ("id_examen") REFERENCES "public"."examenes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_visitas" ADD CONSTRAINT "examenes_visitas_id_sucursal_sucursales_id_fk" FOREIGN KEY ("id_sucursal") REFERENCES "public"."sucursales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_visitas" ADD CONSTRAINT "examenes_visitas_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimientos_visitas" ADD CONSTRAINT "procedimientos_visitas_id_procedimiento_procedimientos_id_fk" FOREIGN KEY ("id_procedimiento") REFERENCES "public"."procedimientos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimientos_visitas" ADD CONSTRAINT "procedimientos_visitas_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_id_paciente_pacientes_id_fk" FOREIGN KEY ("id_paciente") REFERENCES "public"."pacientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_id_enfermera_enfermeras_id_fk" FOREIGN KEY ("id_enfermera") REFERENCES "public"."enfermeras"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_id_sucursal_sucursales_id_fk" FOREIGN KEY ("id_sucursal") REFERENCES "public"."sucursales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sucursales_id_laboratorio_idx" ON "sucursales" USING btree ("id_laboratorio");--> statement-breakpoint
CREATE INDEX "examenes_codigo_idx" ON "examenes" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "enfermeras_apellido_paterno_idx" ON "enfermeras" USING btree ("apellido_paterno");--> statement-breakpoint
CREATE INDEX "telefonos_pacientes_id_paciente_idx" ON "telefonos_pacientes" USING btree ("id_paciente");--> statement-breakpoint
CREATE INDEX "pacientes_apellido_paterno_idx" ON "pacientes" USING btree ("apellido_paterno");--> statement-breakpoint
CREATE INDEX "procedimientos_codigo_idx" ON "procedimientos" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_correo_idx" ON "usuarios" USING btree ("correo");--> statement-breakpoint
CREATE INDEX "examenes_visitas_id_visita_idx" ON "examenes_visitas" USING btree ("id_visita");--> statement-breakpoint
CREATE INDEX "procedimientos_visitas_id_visita_idx" ON "procedimientos_visitas" USING btree ("id_visita");--> statement-breakpoint
CREATE INDEX "visitas_fecha_idx" ON "visitas" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "visitas_estado_idx" ON "visitas" USING btree ("estado");