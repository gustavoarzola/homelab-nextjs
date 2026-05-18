-- Create cotizaciones table
CREATE TABLE IF NOT EXISTS cotizaciones (
  id SERIAL PRIMARY KEY,
  estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
  id_paciente INTEGER REFERENCES pacientes(id) ON DELETE SET NULL,
  nombre_destinatario VARCHAR(255),
  email_destinatario VARCHAR(255),
  telefono_destinatario VARCHAR(50),
  identificacion_destinatario VARCHAR(50),
  comuna VARCHAR(100),
  cobra_visita BOOLEAN NOT NULL DEFAULT false,
  monto_recargo INTEGER DEFAULT 0,
  id_tipo_recargo INTEGER REFERENCES tipos_recargos(id) ON DELETE RESTRICT,
  total INTEGER DEFAULT 0,
  id_visita INTEGER REFERENCES visitas(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX cotizaciones_estado_idx ON cotizaciones(estado);
CREATE INDEX cotizaciones_id_paciente_idx ON cotizaciones(id_paciente);

-- Create cotizacion_examenes table
CREATE TABLE IF NOT EXISTS cotizacion_examenes (
  id SERIAL PRIMARY KEY,
  id_cotizacion INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  id_examen INTEGER NOT NULL REFERENCES examenes(id) ON DELETE RESTRICT,
  descripcion VARCHAR(255) NOT NULL,
  codigo VARCHAR(50),
  precio INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX cotizacion_examenes_id_cotizacion_idx ON cotizacion_examenes(id_cotizacion);

-- Create cotizacion_procedimientos table
CREATE TABLE IF NOT EXISTS cotizacion_procedimientos (
  id SERIAL PRIMARY KEY,
  id_cotizacion INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  id_procedimiento INTEGER NOT NULL REFERENCES procedimientos(id) ON DELETE RESTRICT,
  descripcion VARCHAR(255) NOT NULL,
  codigo VARCHAR(50),
  precio INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX cotizacion_procedimientos_id_cotizacion_idx ON cotizacion_procedimientos(id_cotizacion);
