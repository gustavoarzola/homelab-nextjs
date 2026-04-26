CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Wrapper inmutable requerido para usar unaccent() en índices de expresión
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE INDEX pacientes_nombre_trgm_idx ON pacientes
  USING gin (
    f_unaccent(nombres || ' ' || apellido_paterno || ' ' || COALESCE(apellido_materno, '')) gin_trgm_ops
  );

CREATE INDEX pacientes_identificador_trgm_idx ON pacientes
  USING gin (identificador gin_trgm_ops);
