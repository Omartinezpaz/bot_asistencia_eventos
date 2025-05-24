const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const NotificationService = require('../services/notification-service');
const { Telegraf } = require('telegraf');

// Crear una instancia temporal del bot para el servicio de notificaciones
const bot = new Telegraf(process.env.BOT_TOKEN || 'dummy_token');
const notificationService = new NotificationService(bot.telegram);

// IDs de los eventos a programar (obtenidos del script anterior)
const eventIds = [6, 7]; // Ajusta estos IDs según los resultados del script anterior

async function programarNotificaciones() {
  try {
    console.log('Programando notificaciones para los eventos...');
    
    for (const eventId of eventIds) {
      console.log(`\nProcesando evento ID: ${eventId}`);
      
      try {
        const notificaciones = await notificationService.scheduleAutomaticNotifications(eventId);
        
        if (notificaciones.length === 0) {
          console.log(`❌ No se pudieron programar notificaciones para el evento ${eventId}`);
          continue;
        }
        
        console.log(`✅ Se han programado ${notificaciones.length} notificaciones para el evento ${eventId}:`);
        
        for (const notif of notificaciones) {
          console.log(`• Tipo: ${notif.notification_type}`);
          console.log(`  Fecha: ${new Date(notif.scheduled_date).toLocaleString()}`);
          console.log(`  ID: ${notif.id}`);
        }
      } catch (error) {
        console.error(`Error al programar notificaciones para el evento ${eventId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error general:', error);
  } finally {
    process.exit(0);
  }
}

programarNotificaciones(); 