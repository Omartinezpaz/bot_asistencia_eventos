// Cargar variables de entorno desde .env
require('dotenv').config();

const { sequelize } = require('../database');

async function crearTablaSettings() {
  try {
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL || 'No definido'}`);
    
    console.log('Creando esquema si no existe...');
    await sequelize.query('CREATE SCHEMA IF NOT EXISTS notif_eventos_bot');
    
    console.log('Verificando si existe la tabla app_settings...');
    const [existeTabla] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'notif_eventos_bot'
        AND table_name = 'app_settings'
      ) as existe
    `);
    
    if (existeTabla[0].existe) {
      console.log('La tabla app_settings ya existe.');
      return;
    }
    
    console.log('Creando tabla app_settings...');
    await sequelize.query(`
      CREATE TABLE notif_eventos_bot.app_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        category VARCHAR(50) NOT NULL,
        description VARCHAR(255),
        data_type VARCHAR(20) DEFAULT 'string',
        is_public BOOLEAN DEFAULT false,
        organization_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Tabla app_settings creada exitosamente.');
    
    // Insertar configuraciones predeterminadas
    console.log('Insertando configuraciones predeterminadas...');
    
    // Configuraciones generales
    await sequelize.query(`
      INSERT INTO notif_eventos_bot.app_settings 
        (key, value, category, description, data_type, is_public)
      VALUES
        ('app_name', 'Sistema de Notificación de Eventos', 'general', 'Nombre de la aplicación', 'string', true),
        ('app_description', 'Sistema para gestionar eventos y asistencias', 'general', 'Descripción de la aplicación', 'string', true),
        ('app_logo_url', '', 'general', 'URL del logo de la aplicación', 'string', true),
        ('primary_color', '#3498db', 'general', 'Color primario de la aplicación', 'string', true),
        ('secondary_color', '#2ecc71', 'general', 'Color secundario de la aplicación', 'string', true)
    `);
    
    // Configuraciones del bot
    await sequelize.query(`
      INSERT INTO notif_eventos_bot.app_settings 
        (key, value, category, description, data_type, is_public)
      VALUES
        ('bot_welcome_message', '¡Bienvenido al Bot de Notificaciones! 👋', 'bot', 'Mensaje de bienvenida del bot', 'string', false),
        ('bot_help_message', 'Puedes usar este bot para registrar tu asistencia a eventos y recibir notificaciones importantes.', 'bot', 'Mensaje de ayuda del bot', 'string', false),
        ('bot_enable_location', 'true', 'bot', 'Habilitar solicitud de ubicación para asistencias', 'boolean', false)
    `);
    
    // Configuraciones de notificaciones
    await sequelize.query(`
      INSERT INTO notif_eventos_bot.app_settings 
        (key, value, category, description, data_type, is_public)
      VALUES
        ('notification_before_hours', '24', 'notifications', 'Horas antes del evento para enviar notificaciones', 'number', false),
        ('notification_reminder_template', 'Recordatorio: El evento {{event_name}} está programado para mañana a las {{event_time}}. ¡Te esperamos!', 'notifications', 'Plantilla para recordatorios de eventos', 'string', false),
        ('notification_enable_reminders', 'true', 'notifications', 'Habilitar recordatorios automáticos', 'boolean', false)
    `);
    
    console.log('Configuraciones predeterminadas insertadas exitosamente.');
    
  } catch (error) {
    console.error('Error al crear tabla app_settings:', error);
  } finally {
    // Cerrar la conexión
    await sequelize.close();
  }
}

// Ejecutar la función principal
crearTablaSettings(); 