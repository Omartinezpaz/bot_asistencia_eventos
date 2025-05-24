-- Crear esquema si no existe
CREATE SCHEMA IF NOT EXISTS notif_eventos_bot;

-- Crear tabla de organizaciones
CREATE TABLE IF NOT EXISTS notif_eventos_bot.organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  contact_email VARCHAR(100),
  contact_phone VARCHAR(20),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de administradores de organizaciones
CREATE TABLE IF NOT EXISTS notif_eventos_bot.organization_admins (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_id) REFERENCES notif_eventos_bot.participants(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES notif_eventos_bot.organizations(id) ON DELETE CASCADE
);

-- Añadir columna organization_id a la tabla de participantes si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'notif_eventos_bot' 
    AND table_name = 'participants' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE notif_eventos_bot.participants ADD COLUMN organization_id INTEGER;
    ALTER TABLE notif_eventos_bot.participants ADD CONSTRAINT fk_organization FOREIGN KEY (organization_id) REFERENCES notif_eventos_bot.organizations(id);
  END IF;
END $$;

-- Añadir columna organization_id a la tabla de eventos si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'notif_eventos_bot' 
    AND table_name = 'events' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE notif_eventos_bot.events ADD COLUMN organization_id INTEGER;
    ALTER TABLE notif_eventos_bot.events ADD CONSTRAINT fk_organization FOREIGN KEY (organization_id) REFERENCES notif_eventos_bot.organizations(id);
  END IF;
END $$;

-- Insertar organización por defecto si no existe ninguna
INSERT INTO notif_eventos_bot.organizations (name, description, contact_email, contact_phone)
SELECT 'Organización Principal', 'Organización principal del sistema', 'contacto@organizacion.com', '04242050125'
WHERE NOT EXISTS (SELECT 1 FROM notif_eventos_bot.organizations);

-- Actualizar todos los eventos existentes sin organización asignada
UPDATE notif_eventos_bot.events
SET organization_id = (SELECT id FROM notif_eventos_bot.organizations ORDER BY id LIMIT 1)
WHERE organization_id IS NULL;

-- Buscar o crear el participante administrador
DO $$
DECLARE
  admin_id INTEGER;
  org_id INTEGER;
BEGIN
  -- Obtener ID de la organización principal
  SELECT id INTO org_id FROM notif_eventos_bot.organizations ORDER BY id LIMIT 1;
  
  -- Buscar el participante con el ID de Telegram del administrador
  SELECT id INTO admin_id FROM notif_eventos_bot.participants WHERE telegramid = '5694130379';
  
  -- Si existe, asignarle la organización
  IF admin_id IS NOT NULL THEN
    UPDATE notif_eventos_bot.participants SET organization_id = org_id, rol = 'admin' WHERE id = admin_id;
    
    -- Crear registro de administrador si no existe
    IF NOT EXISTS (SELECT 1 FROM notif_eventos_bot.organization_admins WHERE participant_id = admin_id) THEN
      INSERT INTO notif_eventos_bot.organization_admins (participant_id, organization_id, role)
      VALUES (admin_id, org_id, 'super_admin');
    END IF;
  END IF;
END $$; 