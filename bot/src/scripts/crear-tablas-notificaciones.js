/**
 * Script para crear las tablas necesarias para el sistema de notificaciones
 * 
 * Este script crea las siguientes tablas:
 * - scheduled_notifications: Almacena las notificaciones programadas
 * - notification_stats: Estadísticas agregadas de las notificaciones
 * - notification_recipients: Detalles de los destinatarios de cada notificación
 * 
 * Ejecutar con: node src/scripts/crear-tablas-notificaciones.js
 */

const { sequelize } = require('../database');

async function crearTablasNotificaciones() {
    try {
        console.log('Creando tablas para el sistema de notificaciones...');
        
        // Tabla de notificaciones programadas
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS notif_eventos_bot.scheduled_notifications (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                event_id INTEGER REFERENCES notif_eventos_bot.events(id) ON DELETE SET NULL,
                scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                recipient_type VARCHAR(20) NOT NULL DEFAULT 'all',
                organization_id INTEGER REFERENCES notif_eventos_bot.organizations(id) ON DELETE SET NULL,
                participant_ids INTEGER[],
                include_buttons BOOLEAN DEFAULT true,
                created_by INTEGER REFERENCES notif_eventos_bot.participants(id) ON DELETE SET NULL,
                updated_by INTEGER REFERENCES notif_eventos_bot.participants(id) ON DELETE SET NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
            );
        `);
        
        console.log('Tabla scheduled_notifications creada correctamente');
        
        // Tabla de estadísticas de notificaciones
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS notif_eventos_bot.notification_stats (
                notification_id INTEGER PRIMARY KEY REFERENCES notif_eventos_bot.scheduled_notifications(id) ON DELETE CASCADE,
                total INTEGER DEFAULT 0,
                sent INTEGER DEFAULT 0,
                delivered INTEGER DEFAULT 0,
                read INTEGER DEFAULT 0,
                responded INTEGER DEFAULT 0,
                failed INTEGER DEFAULT 0,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
            );
        `);
        
        console.log('Tabla notification_stats creada correctamente');
        
        // Tabla de detalles de destinatarios
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS notif_eventos_bot.notification_recipients (
                id SERIAL PRIMARY KEY,
                notification_id INTEGER NOT NULL REFERENCES notif_eventos_bot.scheduled_notifications(id) ON DELETE CASCADE,
                participant_id INTEGER REFERENCES notif_eventos_bot.participants(id) ON DELETE SET NULL,
                telegram_id VARCHAR(50),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                sent BOOLEAN DEFAULT false,
                sent_at TIMESTAMP WITH TIME ZONE,
                delivered BOOLEAN DEFAULT false,
                delivered_at TIMESTAMP WITH TIME ZONE,
                read BOOLEAN DEFAULT false,
                read_at TIMESTAMP WITH TIME ZONE,
                responded BOOLEAN DEFAULT false,
                response TEXT,
                response_at TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
            );
        `);
        
        console.log('Tabla notification_recipients creada correctamente');
        
        // Crear índices para mejorar rendimiento
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_status ON notif_eventos_bot.scheduled_notifications(status);
            CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notif_eventos_bot.scheduled_notifications(scheduled_at);
            CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notif_eventos_bot.scheduled_notifications(event_id);
            CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id ON notif_eventos_bot.notification_recipients(notification_id);
            CREATE INDEX IF NOT EXISTS idx_notification_recipients_participant_id ON notif_eventos_bot.notification_recipients(participant_id);
            CREATE INDEX IF NOT EXISTS idx_notification_recipients_status ON notif_eventos_bot.notification_recipients(status);
        `);
        
        console.log('Índices creados correctamente');
        
        console.log('¡Tablas para el sistema de notificaciones creadas correctamente!');
        
    } catch (error) {
        console.error('Error al crear tablas para notificaciones:', error);
    } finally {
        // Cerrar conexión a la base de datos
        await sequelize.close();
    }
}

// Ejecutar la función
crearTablasNotificaciones(); 