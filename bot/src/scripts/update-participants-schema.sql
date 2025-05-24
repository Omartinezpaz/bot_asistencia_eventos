-- Script para añadir la columna rol a la tabla participants
-- Ejecutar con: psql -U usuario -d base_de_datos -f update-participants-schema.sql

-- Añadir la columna rol si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'participants' AND column_name = 'rol'
    ) THEN
        ALTER TABLE notif_eventos_bot.participants ADD COLUMN rol VARCHAR(20) DEFAULT 'user';
        RAISE NOTICE 'Columna rol añadida correctamente';
    ELSE
        RAISE NOTICE 'La columna rol ya existe en la tabla participants';
    END IF;
END $$;

-- Actualizar los usuarios existentes al rol "user" si tienen rol "usuario"
UPDATE notif_eventos_bot.participants
SET rol = 'user'
WHERE rol = 'usuario' OR rol IS NULL;

-- Actualizar el rol de los administradores existentes
-- Nota: Reemplaza 'telegramid_del_admin' con el ID real del administrador
UPDATE notif_eventos_bot.participants
SET rol = 'admin'
WHERE telegramid = '5694130379';

-- Crear índice para búsquedas por rol
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'notif_eventos_bot' AND tablename = 'participants' AND indexname = 'idx_participants_rol'
    ) THEN
        CREATE INDEX idx_participants_rol ON notif_eventos_bot.participants(rol);
        RAISE NOTICE 'Índice para la columna rol creado correctamente';
    ELSE
        RAISE NOTICE 'El índice para la columna rol ya existe';
    END IF;
END $$; 