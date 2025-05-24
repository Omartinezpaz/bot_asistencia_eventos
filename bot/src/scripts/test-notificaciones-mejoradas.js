const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Telegraf } = require('telegraf');
const NotificationService = require('../services/notification-service');

// Crear instancia del bot de Telegram
const bot = new Telegraf(process.env.BOT_TOKEN);

// Crear instancia del servicio de notificaciones
const notificationService = new NotificationService(bot.telegram);

// Configurar la conexión a la base de datos
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false, // Desactivar logging para mayor claridad
  dialectOptions: process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') && process.env.NODE_ENV === 'production' 
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } 
    : {},
  schema: 'notif_eventos_bot'
});

async function testNotificacionesMejoradas() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.\n');

    // 1. Crear un evento de prueba para hoy
    console.log('Creando evento de prueba para hoy...');
    const fechaEvento = new Date();
    fechaEvento.setHours(fechaEvento.getHours() + 1); // El evento será 1 hora después de la hora actual
    
    const [resultEvento] = await sequelize.query(`
      INSERT INTO notif_eventos_bot.events
      (name, description, date, location, active, createdat, updatedat, notification_enabled, notification_hours_before)
      VALUES
      ('Prueba de Notificaciones Mejoradas', 
       'Este es un evento de prueba para verificar el sistema de notificaciones mejorado.',
       $1,
       'Centros de votación designados',
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, 1)
      RETURNING id;
    `, {
      bind: [fechaEvento]
    });
    
    const eventoId = resultEvento[0].id;
    console.log(`✅ Evento de prueba creado con ID: ${eventoId}\n`);

    // 2. Programar notificaciones para este evento
    console.log('Programando notificaciones para el evento...');
    const notificaciones = await notificationService.scheduleAutomaticNotifications(eventoId);
    
    console.log(`✅ Se han programado ${notificaciones.length} notificaciones:\n`);
    for (const notif of notificaciones) {
      console.log(`• Tipo: ${notif.notification_type}`);
      console.log(`  Fecha: ${new Date(notif.scheduled_date).toLocaleString()}`);
      console.log(`  ID: ${notif.id}`);
      console.log();
    }

    // 3. Enviar una notificación de prueba
    console.log('Enviando notificación de prueba (day_before)...');
    
    // Buscar la notificación del día anterior
    const [notificacionDayBefore] = await sequelize.query(`
      SELECT id FROM notif_eventos_bot.scheduled_notifications
      WHERE event_id = $1 AND notification_type = 'day_before'
      LIMIT 1;
    `, {
      bind: [eventoId]
    });
    
    if (notificacionDayBefore.length > 0) {
      const notifId = notificacionDayBefore[0].id;
      
      // Forzar el envío de esta notificación específica
      await sequelize.query(`
        UPDATE notif_eventos_bot.scheduled_notifications
        SET scheduled_date = CURRENT_TIMESTAMP - INTERVAL '1 minute'
        WHERE id = $1;
      `, {
        bind: [notifId]
      });
      
      console.log(`Notificación ${notifId} actualizada para envío inmediato.`);
      
      // Enviar notificaciones pendientes
      const sentCount = await notificationService.sendPendingNotifications();
      console.log(`✅ Se han enviado ${sentCount} notificaciones de prueba.\n`);
    } else {
      console.log('❌ No se encontró la notificación day_before para enviar.\n');
    }

    console.log('Prueba de notificaciones mejoradas completada.');
    console.log('Para ver todas las notificaciones programadas, ejecuta:');
    console.log('node src/scripts/ver-notificaciones.js');
    console.log('\nPara enviar todas las notificaciones pendientes, ejecuta:');
    console.log('node src/scripts/enviar-notificaciones.js --force');
    
  } catch (error) {
    console.error('Error en la prueba de notificaciones:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

testNotificacionesMejoradas(); 