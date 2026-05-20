-- Extensiones para búsqueda con acentos y similitud
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Wrapper inmutable requerido para usar unaccent() en índices de expresión
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS $$
  SELECT unaccent($1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = public;

-- Índices GIN para búsqueda de pacientes por nombre e identificador
CREATE INDEX IF NOT EXISTS pacientes_nombre_trgm_idx ON pacientes
  USING gin (
    f_unaccent(nombres || ' ' || apellido_paterno || ' ' || COALESCE(apellido_materno, '')) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS pacientes_identificador_trgm_idx ON pacientes
  USING gin (identificador gin_trgm_ops);
