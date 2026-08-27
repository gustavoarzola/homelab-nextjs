-- Catálogo de comunas: carga inicial (52 comunas de la Región Metropolitana),
-- rescate de valores existentes que no matcheen el catálogo, y backfill de las
-- columnas id_comuna* recién agregadas (0016) a partir de las columnas de
-- texto todavía presentes (se eliminan en 0018).
--
-- El matching es case/acento-insensible usando f_unaccent() (creada en
-- 0001_search-extensions.sql, IMMUTABLE) para que "Ñuñoa", "nunoa" o "NUÑOA"
-- resuelvan a la misma fila.

-- 1. Comunas de la Región Metropolitana
INSERT INTO "comunas" ("nombre") VALUES
  ('Alhué'),
  ('Buin'),
  ('Calera de Tango'),
  ('Cerrillos'),
  ('Cerro Navia'),
  ('Colina'),
  ('Conchalí'),
  ('Curacaví'),
  ('El Bosque'),
  ('El Monte'),
  ('Estación Central'),
  ('Huechuraba'),
  ('Independencia'),
  ('Isla de Maipo'),
  ('La Cisterna'),
  ('La Florida'),
  ('La Granja'),
  ('La Pintana'),
  ('La Reina'),
  ('Lampa'),
  ('Las Condes'),
  ('Lo Barnechea'),
  ('Lo Espejo'),
  ('Lo Prado'),
  ('Macul'),
  ('Maipú'),
  ('María Pinto'),
  ('Melipilla'),
  ('Ñuñoa'),
  ('Padre Hurtado'),
  ('Paine'),
  ('Pedro Aguirre Cerda'),
  ('Peñaflor'),
  ('Peñalolén'),
  ('Pirque'),
  ('Providencia'),
  ('Pudahuel'),
  ('Puente Alto'),
  ('Quilicura'),
  ('Quinta Normal'),
  ('Recoleta'),
  ('Renca'),
  ('San Bernardo'),
  ('San Joaquín'),
  ('San José de Maipo'),
  ('San Miguel'),
  ('San Pedro'),
  ('San Ramón'),
  ('Santiago'),
  ('Talagante'),
  ('Tiltil'),
  ('Vitacura')
ON CONFLICT ("nombre") DO NOTHING;
--> statement-breakpoint

-- 2. Rescate: cualquier valor ya presente en las columnas de texto que no
-- matchee (case/acento-insensible) ninguna comuna del catálogo se agrega tal
-- cual, para no perder datos ni degradar precios/enfermeras/cotizaciones
-- existentes a "sin comuna" durante el backfill de abajo.
INSERT INTO "comunas" ("nombre")
SELECT DISTINCT btrim(v) FROM (
  SELECT comuna_residencia AS v FROM "enfermeras"
  UNION ALL SELECT comuna FROM "precios_visita_enfermeria"
  UNION ALL SELECT comuna FROM "cotizaciones"
) s
WHERE v IS NOT NULL AND btrim(v) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "comunas" c
    WHERE lower(f_unaccent(c.nombre)) = lower(f_unaccent(btrim(s.v)))
  );
--> statement-breakpoint

-- 3. Backfill enfermeras.id_comuna_residencia
UPDATE "enfermeras" e
SET "id_comuna_residencia" = c.id
FROM "comunas" c
WHERE e.comuna_residencia IS NOT NULL
  AND btrim(e.comuna_residencia) <> ''
  AND lower(f_unaccent(c.nombre)) = lower(f_unaccent(btrim(e.comuna_residencia)));
--> statement-breakpoint

-- 4. Backfill precios_visita_enfermeria.id_comuna (la fila base, comuna IS
-- NULL, queda con id_comuna NULL — es el comportamiento esperado).
UPDATE "precios_visita_enfermeria" p
SET "id_comuna" = c.id
FROM "comunas" c
WHERE p.comuna IS NOT NULL
  AND btrim(p.comuna) <> ''
  AND lower(f_unaccent(c.nombre)) = lower(f_unaccent(btrim(p.comuna)));
--> statement-breakpoint

-- 5. Backfill cotizaciones.id_comuna
UPDATE "cotizaciones" q
SET "id_comuna" = c.id
FROM "comunas" c
WHERE q.comuna IS NOT NULL
  AND btrim(q.comuna) <> ''
  AND lower(f_unaccent(c.nombre)) = lower(f_unaccent(btrim(q.comuna)));
