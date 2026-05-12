-- Crear tabla de tipos de recargos
CREATE TABLE IF NOT EXISTS tipos_recargos (
  id serial PRIMARY KEY,
  nombre varchar(200) NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Actualizar tabla de visitas
ALTER TABLE visitas
  DROP COLUMN IF EXISTS razon_recargo,
  ADD COLUMN IF NOT EXISTS id_tipo_recargo integer;

-- Agregar foreign key
ALTER TABLE visitas
  ADD CONSTRAINT fk_visitas_id_tipo_recargo
  FOREIGN KEY (id_tipo_recargo) REFERENCES tipos_recargos(id) ON DELETE RESTRICT;
