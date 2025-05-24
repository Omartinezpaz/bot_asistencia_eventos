const NotificationService = require('./services/notification-service');
const { Telegraf } = require('telegraf');
const cron = require('node-cron');

/**
 * Clase para gestionar la programación de envío de notificaciones
 */
class NotificationScheduler {
  /**
   * Constructor
   * @param {Object} bot - Instancia del bot de Telegram
   */
  constructor(bot) {
    this.bot = bot;
    this.notificationService = new NotificationService(bot.telegram);
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Inicia el programador de notificaciones
   * @param {string} schedule - Expresión cron para la programación (por defecto: cada 5 minutos)
   */
  start(schedule = '*/5 * * * *') {
    if (this.isRunning) {
      console.log('El programador de notificaciones ya está en ejecución');
      return;
    }

    console.log(`Iniciando programador de notificaciones con schedule: ${schedule}`);
    
    // Validar la expresión cron
    if (!cron.validate(schedule)) {
      console.error(`Expresión cron inválida: ${schedule}`);
      return;
    }

    // Crear el trabajo cron
    this.cronJob = cron.schedule(schedule, async () => {
      console.log(`[${new Date().toISOString()}] Ejecutando verificación de notificaciones pendientes...`);
      
      try {
        const sentCount = await this.notificationService.sendPendingNotifications();
        console.log(`[${new Date().toISOString()}] Se enviaron ${sentCount} notificaciones`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error al enviar notificaciones:`, error);
      }
    });

    this.isRunning = true;
    console.log('Programador de notificaciones iniciado correctamente');
  }

  /**
   * Detiene el programador de notificaciones
   */
  stop() {
    if (!this.isRunning) {
      console.log('El programador de notificaciones no está en ejecución');
      return;
    }

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isRunning = false;
    console.log('Programador de notificaciones detenido');
  }

  /**
   * Ejecuta una verificación manual de notificaciones pendientes
   */
  async checkNow() {
    console.log(`[${new Date().toISOString()}] Ejecutando verificación manual de notificaciones...`);
    
    try {
      const sentCount = await this.notificationService.sendPendingNotifications();
      console.log(`[${new Date().toISOString()}] Se enviaron ${sentCount} notificaciones`);
      return sentCount;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error al enviar notificaciones:`, error);
      throw error;
    }
  }
}

module.exports = NotificationScheduler; 