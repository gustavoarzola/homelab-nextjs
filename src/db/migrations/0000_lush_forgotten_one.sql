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
CREATE TABLE "origenes_contacto" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"grupo_examen" varchar(50) DEFAULT 'imalab' NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companias_seguros" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"categoria" varchar(20),
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
	"porcentaje_pago" numeric(5, 2) DEFAULT '67.5' NOT NULL,
	"comuna_residencia" varchar(100),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precios_visita_enfermeria" (
	"id" serial PRIMARY KEY NOT NULL,
	"comuna" varchar(200),
	"precio" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
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
	"identificador" varchar(200),
	"tipo_identificador" varchar(20),
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
	CONSTRAINT "pacientes_identificador_unique" UNIQUE("identificador")
);
--> statement-breakpoint
CREATE TABLE "procedimientos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"categoria" varchar(50) DEFAULT 'otros' NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizacion_examenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_cotizacion" integer NOT NULL,
	"id_examen" integer NOT NULL,
	"descripcion" varchar(255) NOT NULL,
	"codigo" varchar(50),
	"precio" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizacion_procedimientos" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_cotizacion" integer NOT NULL,
	"id_procedimiento" integer NOT NULL,
	"descripcion" varchar(255) NOT NULL,
	"codigo" varchar(50),
	"precio" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizacion_talleres" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_cotizacion" integer NOT NULL,
	"id_taller" integer NOT NULL,
	"descripcion" varchar(255) NOT NULL,
	"codigo" varchar(50),
	"precio" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"estado" varchar(20) DEFAULT 'borrador' NOT NULL,
	"id_paciente" integer,
	"nombre_destinatario" varchar(255),
	"email_destinatario" varchar(255),
	"telefono_destinatario" varchar(50),
	"identificacion_destinatario" varchar(50),
	"comuna" varchar(100),
	"cobra_visita" boolean DEFAULT false NOT NULL,
	"monto_recargo" integer DEFAULT 0,
	"id_tipo_recargo" integer,
	"total" integer DEFAULT 0,
	"id_visita" integer,
	"notas" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_recargos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
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
	"id_visita" integer NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedimientos_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_procedimiento" integer NOT NULL,
	"id_visita" integer NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talleres_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_taller" integer NOT NULL,
	"id_visita" integer NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
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
	"id_laboratorio" integer,
	"numero_boleta" varchar(20) DEFAULT '',
	"tipo_documento" varchar(20) DEFAULT '',
	"numero_atencion" integer,
	"origen_contacto" varchar(100),
	"informacion_adicional" text DEFAULT '',
	"pagado" boolean DEFAULT false NOT NULL,
	"metodo_pago" varchar(30),
	"fecha_pago" date,
	"resultados_enviados" boolean DEFAULT false NOT NULL,
	"fecha_envio_resultados" date,
	"costo_traslado" integer DEFAULT 0 NOT NULL,
	"cobra_visita" boolean DEFAULT false NOT NULL,
	"monto_recargo" integer DEFAULT 0,
	"id_tipo_recargo" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talleres" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telefonos_pacientes" ADD CONSTRAINT "telefonos_pacientes_id_paciente_pacientes_id_fk" FOREIGN KEY ("id_paciente") REFERENCES "public"."pacientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_id_direccion_direcciones_id_fk" FOREIGN KEY ("id_direccion") REFERENCES "public"."direcciones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_examenes" ADD CONSTRAINT "cotizacion_examenes_id_cotizacion_cotizaciones_id_fk" FOREIGN KEY ("id_cotizacion") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_examenes" ADD CONSTRAINT "cotizacion_examenes_id_examen_examenes_id_fk" FOREIGN KEY ("id_examen") REFERENCES "public"."examenes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_procedimientos" ADD CONSTRAINT "cotizacion_procedimientos_id_cotizacion_cotizaciones_id_fk" FOREIGN KEY ("id_cotizacion") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_procedimientos" ADD CONSTRAINT "cotizacion_procedimientos_id_procedimiento_procedimientos_id_fk" FOREIGN KEY ("id_procedimiento") REFERENCES "public"."procedimientos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_talleres" ADD CONSTRAINT "cotizacion_talleres_id_cotizacion_cotizaciones_id_fk" FOREIGN KEY ("id_cotizacion") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_talleres" ADD CONSTRAINT "cotizacion_talleres_id_taller_talleres_id_fk" FOREIGN KEY ("id_taller") REFERENCES "public"."talleres"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_id_paciente_pacientes_id_fk" FOREIGN KEY ("id_paciente") REFERENCES "public"."pacientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_id_tipo_recargo_tipos_recargos_id_fk" FOREIGN KEY ("id_tipo_recargo") REFERENCES "public"."tipos_recargos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_visitas" ADD CONSTRAINT "examenes_visitas_id_examen_examenes_id_fk" FOREIGN KEY ("id_examen") REFERENCES "public"."examenes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examenes_visitas" ADD CONSTRAINT "examenes_visitas_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimientos_visitas" ADD CONSTRAINT "procedimientos_visitas_id_procedimiento_procedimientos_id_fk" FOREIGN KEY ("id_procedimiento") REFERENCES "public"."procedimientos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimientos_visitas" ADD CONSTRAINT "procedimientos_visitas_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talleres_visitas" ADD CONSTRAINT "talleres_visitas_id_taller_talleres_id_fk" FOREIGN KEY ("id_taller") REFERENCES "public"."talleres"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talleres_visitas" ADD CONSTRAINT "talleres_visitas_id_visita_visitas_id_fk" FOREIGN KEY ("id_visita") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_id_paciente_pacientes_id_fk" FOREIGN KEY ("id_paciente") REFERENCES "public"."pacientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_id_enfermera_enfermeras_id_fk" FOREIGN KEY ("id_enfermera") REFERENCES "public"."enfermeras"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_id_laboratorio_laboratorios_id_fk" FOREIGN KEY ("id_laboratorio") REFERENCES "public"."laboratorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_id_tipo_recargo_tipos_recargos_id_fk" FOREIGN KEY ("id_tipo_recargo") REFERENCES "public"."tipos_recargos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "examenes_codigo_idx" ON "examenes" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "examenes_nombre_codigo_grupo_idx" ON "examenes" USING btree ("nombre","codigo","grupo_examen");--> statement-breakpoint
CREATE INDEX "enfermeras_apellido_paterno_idx" ON "enfermeras" USING btree ("apellido_paterno");--> statement-breakpoint
CREATE INDEX "precios_visita_enfermeria_comuna_idx" ON "precios_visita_enfermeria" USING btree ("comuna");--> statement-breakpoint
CREATE INDEX "telefonos_pacientes_id_paciente_idx" ON "telefonos_pacientes" USING btree ("id_paciente");--> statement-breakpoint
CREATE INDEX "pacientes_apellido_paterno_idx" ON "pacientes" USING btree ("apellido_paterno");--> statement-breakpoint
CREATE INDEX "procedimientos_codigo_idx" ON "procedimientos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "cotizacion_examenes_id_cotizacion_idx" ON "cotizacion_examenes" USING btree ("id_cotizacion");--> statement-breakpoint
CREATE INDEX "cotizacion_procedimientos_id_cotizacion_idx" ON "cotizacion_procedimientos" USING btree ("id_cotizacion");--> statement-breakpoint
CREATE INDEX "cotizacion_talleres_id_cotizacion_idx" ON "cotizacion_talleres" USING btree ("id_cotizacion");--> statement-breakpoint
CREATE INDEX "cotizaciones_estado_idx" ON "cotizaciones" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "cotizaciones_id_paciente_idx" ON "cotizaciones" USING btree ("id_paciente");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_correo_idx" ON "usuarios" USING btree ("correo");--> statement-breakpoint
CREATE INDEX "examenes_visitas_id_visita_idx" ON "examenes_visitas" USING btree ("id_visita");--> statement-breakpoint
CREATE INDEX "procedimientos_visitas_id_visita_idx" ON "procedimientos_visitas" USING btree ("id_visita");--> statement-breakpoint
CREATE INDEX "talleres_visitas_id_visita_idx" ON "talleres_visitas" USING btree ("id_visita");--> statement-breakpoint
CREATE INDEX "visitas_fecha_idx" ON "visitas" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "visitas_estado_idx" ON "visitas" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "visitas_numero_atencion_idx" ON "visitas" USING btree ("numero_atencion") WHERE "visitas"."numero_atencion" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "visitas_numero_boleta_tipo_doc_idx" ON "visitas" USING btree ("numero_boleta","tipo_documento") WHERE "visitas"."numero_boleta" IS NOT NULL AND "visitas"."numero_boleta" != '';--> statement-breakpoint
CREATE INDEX "talleres_codigo_idx" ON "talleres" USING btree ("codigo");