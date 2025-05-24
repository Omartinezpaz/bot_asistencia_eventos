-- Script para crear la tabla de estadísticas de notificaciones
-- Ejecutar con: psql -U usuario -d base_de_datos -f create-notification-stats.sql

-- Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS notif_eventos_bot.notification_stats (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    sent BOOLEAN DEFAULT FALSE,
    delivered BOOLEAN DEFAULT FALSE,
    read BOOLEAN DEFAULT FALSE,
    responded BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    sent_date TIMESTAMP,
    delivered_date TIMESTAMP,
    read_date TIMESTAMP,
    response_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_notification_stats_notification_id ON notif_eventos_bot.notification_stats(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_stats_participant_id ON notif_eventos_bot.notification_stats(participant_id);
CREATE INDEX IF NOT EXISTS idx_notification_stats_sent ON notif_eventos_bot.notification_stats(sent);
CREATE INDEX IF NOT EXISTS idx_notification_stats_delivered ON notif_eventos_bot.notification_stats(delivered);
CREATE INDEX IF NOT EXISTS idx_notification_stats_read ON notif_eventos_bot.notification_stats(read);
CREATE INDEX IF NOT EXISTS idx_notification_stats_responded ON notif_eventos_bot.notification_stats(responded);

-- Añadir restricciones de clave foránea
ALTER TABLE notif_eventos_bot.notification_stats
    ADD CONSTRAINT fk_notification_stats_notification
    FOREIGN KEY (notification_id)
    REFERENCES notif_eventos_bot.scheduled_notifications(id)
    ON DELETE CASCADE;

ALTER TABLE notif_eventos_bot.notification_stats
    ADD CONSTRAINT fk_notification_stats_participant
    FOREIGN KEY (participant_id)
    REFERENCES notif_eventos_bot.participants(id)
    ON DELETE CASCADE;

-- Crear una vista para estadísticas generales
CREATE OR REPLACE VIEW notif_eventos_bot.notification_stats_summary AS
SELECT
    n.id AS notification_id,
    n.notification_type,
    n.event_id,
    e.name AS event_name,
    COUNT(ns.id) AS total_participants,
    SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END) AS sent_count,
    SUM(CASE WHEN ns.delivered THEN 1 ELSE 0 END) AS delivered_count,
    SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) AS read_count,
    SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) AS responded_count,
    CASE 
        WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
        ELSE 0
    END AS sent_percentage,
    CASE 
        WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.delivered THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
        ELSE 0
    END AS delivered_percentage,
    CASE 
        WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
        ELSE 0
    END AS read_percentage,
    CASE 
        WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
        ELSE 0
    END AS responded_percentage
FROM
    notif_eventos_bot.scheduled_notifications n
LEFT JOIN
    notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
LEFT JOIN
    notif_eventos_bot.events e ON n.event_id = e.id
GROUP BY
    n.id, n.notification_type, n.event_id, e.name
ORDER BY
    n.id; 