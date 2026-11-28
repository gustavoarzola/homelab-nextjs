CREATE TABLE "categorias_costos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costos_mensuales" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_categoria" integer NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"monto" integer DEFAULT 0 NOT NULL,
	"notas" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "costos_mensuales_mes_check" CHECK ("costos_mensuales"."mes" BETWEEN 1 AND 12),
	CONSTRAINT "costos_mensuales_monto_check" CHECK ("costos_mensuales"."monto" >= 0)
);
--> statement-breakpoint
ALTER TABLE "costos_mensuales" ADD CONSTRAINT "costos_mensuales_id_categoria_categorias_costos_id_fk" FOREIGN KEY ("id_categoria") REFERENCES "public"."categorias_costos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_costos_nombre_idx" ON "categorias_costos" USING btree ("nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "costos_mensuales_categoria_periodo_idx" ON "costos_mensuales" USING btree ("id_categoria","anio","mes");--> statement-breakpoint
CREATE INDEX "costos_mensuales_periodo_idx" ON "costos_mensuales" USING btree ("anio","mes");