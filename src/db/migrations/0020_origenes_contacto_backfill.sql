-- Orígenes de contacto: rescate de valores existentes en visitas.origen_contacto que no
-- matcheen ninguna fila del catálogo (p. ej. 'Sistema', escrito por el seed de operación),
-- y backfill de visitas.id_origen_contacto (columna agregada en 0019) a partir del texto
-- todavía presente en visitas.origen_contacto (se elimina en 0021).
--
-- El matching es case/acento-insensible usando f_unaccent() (creada en
-- 0001_search-extensions.sql, IMMUTABLE), igual que el backfill de comunas (0017).

-- 1. Rescatar valores de texto que no existan en el catálogo
INSERT INTO "origenes_contacto" ("nombre")
SELECT DISTINCT trim(v."origen_contacto")
FROM "visitas" v
WHERE v."origen_contacto" IS NOT NULL
  AND trim(v."origen_contacto") != ''
  AND NOT EXISTS (
    SELECT 1 FROM "origenes_contacto" o
    WHERE f_unaccent(lower(o."nombre")) = f_unaccent(lower(trim(v."origen_contacto")))
  )
ON CONFLICT ("nombre") DO NOTHING;

-- 2. Backfill de id_origen_contacto por nombre normalizado
UPDATE "visitas" v
SET "id_origen_contacto" = o."id"
FROM "origenes_contacto" o
WHERE v."origen_contacto" IS NOT NULL
  AND trim(v."origen_contacto") != ''
  AND f_unaccent(lower(o."nombre")) = f_unaccent(lower(trim(v."origen_contacto")))
  AND v."id_origen_contacto" IS NULL;
