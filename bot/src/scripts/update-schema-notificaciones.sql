-- Script para añadir la tabla de notificaciones programadas
-- Ejecutar con: psql -U usuario -d base_de_datos -f update-schema-notificaciones.sql

-- Crear la tabla de notificaciones programadas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'scheduled_notifications'
    ) THEN
        CREATE TABLE notif_eventos_bot.scheduled_notifications (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL,
            notification_type VARCHAR(50) NOT NULL,
            message_template TEXT NOT NULL,
            scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
            sent BOOLEAN DEFAULT FALSE,
            sent_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_event FOREIGN KEY (event_id) REFERENCES notif_eventos_bot.events(id) ON DELETE CASCADE
        );
        RAISE NOTICE 'Tabla scheduled_notifications creada correctamente';
    ELSE
        RAISE NOTICE 'La tabla scheduled_notifications ya existe';
    END IF;
END $$;

-- Crear índices para mejorar el rendimiento
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'notif_eventos_bot' AND indexname = 'idx_scheduled_notifications_event'
    ) THEN
        CREATE INDEX idx_scheduled_notifications_event
        ON notif_eventos_bot.scheduled_notifications (event_id);
        RAISE NOTICE 'Índice idx_scheduled_notifications_event creado';
    ELSE
        RAISE NOTICE 'Índice idx_scheduled_notifications_event ya existe';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'notif_eventos_bot' AND indexname = 'idx_scheduled_notifications_pending'
    ) THEN
        CREATE INDEX idx_scheduled_notifications_pending
        ON notif_eventos_bot.scheduled_notifications (scheduled_date) 
        WHERE sent = FALSE;
        RAISE NOTICE 'Índice idx_scheduled_notifications_pending creado';
    ELSE
        RAISE NOTICE 'Índice idx_scheduled_notifications_pending ya existe';
    END IF;
END $$;

-- Añadir campo para notificaciones a la tabla de eventos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'events' AND column_name = 'notification_enabled'
    ) THEN
        ALTER TABLE notif_eventos_bot.events ADD COLUMN notification_enabled BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Campo notification_enabled añadido a la tabla events';
    ELSE
        RAISE NOTICE 'Campo notification_enabled ya existe en la tabla events';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'events' AND column_name = 'notification_hours_before'
    ) THEN
        ALTER TABLE notif_eventos_bot.events ADD COLUMN notification_hours_before INTEGER DEFAULT 24;
        RAISE NOTICE 'Campo notification_hours_before añadido a la tabla events';
    ELSE
        RAISE NOTICE 'Campo notification_hours_before ya existe en la tabla events';
    END IF;
END $$;

-- Mostrar información sobre la nueva tabla
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'notif_eventos_bot' AND 
    table_name = 'scheduled_notifications' 
ORDER BY 
    ordinal_position; 