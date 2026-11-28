-- "costos" → "gastos": renombra tablas, secuencias, constraints e índices del módulo de gastos
-- mensuales (migraciones 0025/0026). Conserva los datos.
ALTER TABLE "grupos_costos" RENAME TO "grupos_gastos";--> statement-breakpoint
ALTER TABLE "categorias_costos" RENAME TO "categorias_gastos";--> statement-breakpoint
ALTER TABLE "costos_mensuales" RENAME TO "gastos_mensuales";--> statement-breakpoint
ALTER SEQUENCE "grupos_costos_id_seq" RENAME TO "grupos_gastos_id_seq";--> statement-breakpoint
ALTER SEQUENCE "categorias_costos_id_seq" RENAME TO "categorias_gastos_id_seq";--> statement-breakpoint
ALTER SEQUENCE "costos_mensuales_id_seq" RENAME TO "gastos_mensuales_id_seq";--> statement-breakpoint
ALTER TABLE "grupos_gastos" RENAME CONSTRAINT "grupos_costos_pkey" TO "grupos_gastos_pkey";--> statement-breakpoint
ALTER TABLE "categorias_gastos" RENAME CONSTRAINT "categorias_costos_pkey" TO "categorias_gastos_pkey";--> statement-breakpoint
ALTER TABLE "gastos_mensuales" RENAME CONSTRAINT "costos_mensuales_pkey" TO "gastos_mensuales_pkey";--> statement-breakpoint
ALTER TABLE "categorias_gastos" RENAME CONSTRAINT "categorias_costos_id_grupo_grupos_costos_id_fk" TO "categorias_gastos_id_grupo_grupos_gastos_id_fk";--> statement-breakpoint
ALTER TABLE "gastos_mensuales" RENAME CONSTRAINT "costos_mensuales_id_categoria_categorias_costos_id_fk" TO "gastos_mensuales_id_categoria_categorias_gastos_id_fk";--> statement-breakpoint
ALTER TABLE "gastos_mensuales" RENAME CONSTRAINT "costos_mensuales_mes_check" TO "gastos_mensuales_mes_check";--> statement-breakpoint
ALTER TABLE "gastos_mensuales" RENAME CONSTRAINT "costos_mensuales_monto_check" TO "gastos_mensuales_monto_check";--> statement-breakpoint
ALTER INDEX "grupos_costos_nombre_idx" RENAME TO "grupos_gastos_nombre_idx";--> statement-breakpoint
ALTER INDEX "categorias_costos_nombre_idx" RENAME TO "categorias_gastos_nombre_idx";--> statement-breakpoint
ALTER INDEX "categorias_costos_id_grupo_idx" RENAME TO "categorias_gastos_id_grupo_idx";--> statement-breakpoint
ALTER INDEX "costos_mensuales_categoria_periodo_idx" RENAME TO "gastos_mensuales_categoria_periodo_idx";--> statement-breakpoint
ALTER INDEX "costos_mensuales_periodo_idx" RENAME TO "gastos_mensuales_periodo_idx";
