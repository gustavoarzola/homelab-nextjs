ALTER TABLE "usuarios" ALTER COLUMN "rol" SET DEFAULT 'ejecutivo';--> statement-breakpoint
UPDATE "usuarios" SET "rol" = 'ejecutivo' WHERE "rol" = 'usuario';
