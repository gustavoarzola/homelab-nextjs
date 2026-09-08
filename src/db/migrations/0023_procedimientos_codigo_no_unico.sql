DROP INDEX "procedimientos_codigo_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "procedimientos_nombre_codigo_idx" ON "procedimientos" USING btree ("nombre","codigo");--> statement-breakpoint
CREATE INDEX "procedimientos_codigo_idx" ON "procedimientos" USING btree ("codigo");