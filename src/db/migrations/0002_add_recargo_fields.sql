-- Agregar campos de recargo a la tabla visitas
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS monto_recargo integer DEFAULT 0;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS razon_recargo text;
