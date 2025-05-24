const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const NotificationService = require('../services/notification-service');
const { Telegraf } = require('telegraf');

// Crear una instancia temporal del bot para el servicio de notificaciones
const bot = new Telegraf(process.env.BOT_TOKEN || 'dummy_token');
const notificationService = new NotificationService(bot.telegram);

async function enviarNotificaciones() {
  try {
    console.log('Iniciando envío de notificaciones pendientes...');
    
    // Opcionalmente, podemos forzar el envío de notificaciones independientemente de la fecha programada
    const forzarEnvio = process.argv.includes('--force');
    
    if (forzarEnvio) {
      console.log('⚠️ Modo forzado activado: Se enviarán todas las notificaciones pendientes sin importar la fecha programada');
    } else {
      console.log('Modo normal: Solo se enviarán las notificaciones cuya fecha programada ya haya pasado');
    }
    
    const sentCount = await notificationService.sendPendingNotifications(forzarEnvio);
    
    console.log(`\n✅ Se han enviado ${sentCount} notificaciones pendientes.`);
    
    if (sentCount === 0 && !forzarEnvio) {
      console.log('\nSi deseas forzar el envío de todas las notificaciones pendientes, ejecuta:');
      console.log('node src/scripts/enviar-notificaciones.js --force');
    }
  } catch (error) {
    console.error('Error al enviar notificaciones:', error);
  } finally {
    process.exit(0);
  }
}

enviarNotificaciones(); 