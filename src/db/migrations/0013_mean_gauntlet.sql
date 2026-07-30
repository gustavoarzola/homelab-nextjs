DROP INDEX "procedimientos_codigo_idx";--> statement-breakpoint
DROP INDEX "talleres_codigo_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "origenes_contacto_nombre_idx" ON "origenes_contacto" USING btree ("nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "residencias_adulto_mayor_nombre_idx" ON "residencias_adulto_mayor" USING btree ("nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "companias_seguros_nombre_idx" ON "companias_seguros" USING btree ("nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "precios_visita_enfermeria_comuna_key" ON "precios_visita_enfermeria" USING btree ("comuna") WHERE "precios_visita_enfermeria"."comuna" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tipos_recargos_nombre_idx" ON "tipos_recargos" USING btree ("nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "procedimientos_codigo_idx" ON "procedimientos" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "talleres_codigo_idx" ON "talleres" USING btree ("codigo");