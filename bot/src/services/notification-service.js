const { NotificacionProgramada, Evento, Participante, RegistroElectoral, CentroVotacion, Geografia, NotificacionEstadistica } = require('../database');
const { Op } = require('sequelize');

/**
 * Servicio para gestionar las notificaciones programadas
 */
class NotificationService {
  /**
   * Constructor
   * @param {Object} bot - Instancia del bot de Telegram
   */
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Programa una notificación para un evento
   * @param {number} eventId - ID del evento
   * @param {string} notificationType - Tipo de notificación (reminder, day_before, etc.)
   * @param {string} messageTemplate - Plantilla del mensaje
   * @param {Date} scheduledDate - Fecha programada para enviar la notificación
   * @returns {Promise<Object>} - La notificación programada
   */
  async scheduleNotification(eventId, notificationType, messageTemplate, scheduledDate) {
    try {
      // Verificar que el evento existe
      const evento = await Evento.findByPk(eventId);
      if (!evento) {
        throw new Error(`El evento con ID ${eventId} no existe`);
      }

      // Crear la notificación programada
      const notificacion = await NotificacionProgramada.create({
        event_id: eventId,
        notification_type: notificationType,
        message_template: messageTemplate,
        scheduled_date: scheduledDate
      });

      console.log(`Notificación programada para el evento ${eventId} a las ${scheduledDate}`);
      return notificacion;
    } catch (error) {
      console.error('Error al programar notificación:', error);
      throw error;
    }
  }

  /**
   * Programa notificaciones automáticas para un evento
   * @param {number} eventId - ID del evento
   * @returns {Promise<Array>} - Las notificaciones programadas
   */
  async scheduleAutomaticNotifications(eventId) {
    try {
      const evento = await Evento.findByPk(eventId);
      if (!evento) {
        throw new Error(`El evento con ID ${eventId} no existe`);
      }

      if (!evento.notification_enabled) {
        console.log(`Las notificaciones están desactivadas para el evento ${eventId}`);
        return [];
      }

      const eventDate = new Date(evento.date);
      const notificaciones = [];

      // Notificación el día antes
      const dayBeforeDate = new Date(eventDate);
      dayBeforeDate.setDate(dayBeforeDate.getDate() - 1);
      dayBeforeDate.setHours(10, 0, 0, 0); // A las 10:00 AM

      const dayBeforeTemplate = this.getDayBeforeTemplate(evento);
      const dayBeforeNotification = await this.scheduleNotification(
        eventId,
        'day_before',
        dayBeforeTemplate,
        dayBeforeDate
      );
      notificaciones.push(dayBeforeNotification);

      // Notificación el mismo día (temprano)
      const sameDayEarlyDate = new Date(eventDate);
      sameDayEarlyDate.setHours(7, 0, 0, 0); // A las 7:00 AM

      const sameDayEarlyTemplate = this.getSameDayEarlyTemplate(evento);
      const sameDayEarlyNotification = await this.scheduleNotification(
        eventId,
        'same_day_early',
        sameDayEarlyTemplate,
        sameDayEarlyDate
      );
      notificaciones.push(sameDayEarlyNotification);

      // Notificación el mismo día (mediodía)
      const sameDayNoonDate = new Date(eventDate);
      sameDayNoonDate.setHours(12, 0, 0, 0); // A las 12:00 PM

      const sameDayNoonTemplate = this.getSameDayNoonTemplate(evento);
      const sameDayNoonNotification = await this.scheduleNotification(
        eventId,
        'same_day_noon',
        sameDayNoonTemplate,
        sameDayNoonDate
      );
      notificaciones.push(sameDayNoonNotification);

      // Notificación el mismo día (tarde)
      const sameDayAfternoonDate = new Date(eventDate);
      sameDayAfternoonDate.setHours(16, 0, 0, 0); // A las 4:00 PM

      const sameDayAfternoonTemplate = this.getSameDayAfternoonTemplate(evento);
      const sameDayAfternoonNotification = await this.scheduleNotification(
        eventId,
        'same_day_afternoon',
        sameDayAfternoonTemplate,
        sameDayAfternoonDate
      );
      notificaciones.push(sameDayAfternoonNotification);

      // Notificación después del evento
      const afterEventDate = new Date(eventDate);
      afterEventDate.setDate(afterEventDate.getDate() + 1);
      afterEventDate.setHours(10, 0, 0, 0); // A las 10:00 AM del día siguiente

      const afterEventTemplate = this.getAfterEventTemplate(evento);
      const afterEventNotification = await this.scheduleNotification(
        eventId,
        'after_event',
        afterEventTemplate,
        afterEventDate
      );
      notificaciones.push(afterEventNotification);

      console.log(`Se han programado ${notificaciones.length} notificaciones para el evento ${eventId}`);
      return notificaciones;
    } catch (error) {
      console.error('Error al programar notificaciones automáticas:', error);
      throw error;
    }
  }

  /**
   * Obtiene la plantilla de mensaje para la notificación del día anterior
   * @param {Object} evento - Evento para el que se genera la notificación
   * @returns {string} - Plantilla del mensaje
   */
  getDayBeforeTemplate(evento) {
    const eventDate = new Date(evento.date);
    const formattedDate = eventDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return `🗳️ *Recordatorio importante*\n\n` +
           `¡Mañana ${formattedDate} es el día de las elecciones! Recuerda que debes acudir a tu centro de votación para ejercer tu derecho al voto.\n\n` +
           `*Evento:* ${evento.name}\n` +
           `*Fecha:* ${formattedDate}\n` +
           `*Lugar:* ${evento.location}\n\n` +
           `Puedes consultar tu centro de votación con el comando /centro\n\n` +
           `🇻🇪 ¡Tu participación es fundamental para el futuro de Venezuela!`;
  }

  /**
   * Obtiene la plantilla de mensaje para la notificación de la mañana del mismo día
   * @param {Object} evento - Evento para el que se genera la notificación
   * @returns {string} - Plantilla del mensaje
   */
  getSameDayEarlyTemplate(evento) {
    const eventDate = new Date(evento.date);
    const formattedDate = eventDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return `🗳️ *¡Hoy son las elecciones!*\n\n` +
           `Buenos días. Hoy ${formattedDate} es el día de las elecciones. Te recomendamos acudir temprano a tu centro de votación.\n\n` +
           `*Evento:* ${evento.name}\n` +
           `*Lugar:* ${evento.location}\n\n` +
           `Puedes consultar tu centro de votación con el comando /centro\n\n` +
           `Recuerda reportar tu asistencia cuando hayas votado usando el comando /asistencia\n\n` +
           `🇻🇪 ¡Tu voto cuenta para el futuro de Venezuela!`;
  }

  /**
   * Obtiene la plantilla de mensaje para la notificación del mediodía del mismo día
   * @param {Object} evento - Evento para el que se genera la notificación
   * @returns {string} - Plantilla del mensaje
   */
  getSameDayNoonTemplate(evento) {
    return `🗳️ *Recordatorio de mediodía*\n\n` +
           `Si aún no has votado, te recordamos que hoy son las elecciones. Los centros de votación permanecerán abiertos hasta las 6:00 PM.\n\n` +
           `*Evento:* ${evento.name}\n\n` +
           `Puedes consultar tu centro de votación con el comando /centro\n\n` +
           `Recuerda reportar tu asistencia cuando hayas votado usando el comando /asistencia\n\n` +
           `🇻🇪 ¡Tu participación es importante!`;
  }

  /**
   * Obtiene la plantilla de mensaje para la notificación de la tarde del mismo día
   * @param {Object} evento - Evento para el que se genera la notificación
   * @returns {string} - Plantilla del mensaje
   */
  getSameDayAfternoonTemplate(evento) {
    return `🗳️ *Último recordatorio*\n\n` +
           `Si aún no has votado, te recordamos que los centros de votación cerrarán a las 6:00 PM. ¡Aún estás a tiempo!\n\n` +
           `*Evento:* ${evento.name}\n\n` +
           `Puedes consultar tu centro de votación con el comando /centro\n\n` +
           `Recuerda reportar tu asistencia cuando hayas votado usando el comando /asistencia\n\n` +
           `🇻🇪 ¡Cada voto cuenta!`;
  }

  /**
   * Obtiene la plantilla de mensaje para la notificación posterior al evento
   * @param {Object} evento - Evento para el que se genera la notificación
   * @returns {string} - Plantilla del mensaje
   */
  getAfterEventTemplate(evento) {
    return `🗳️ *Gracias por participar*\n\n` +
           `El proceso electoral ha concluido. Gracias a todos los que ejercieron su derecho al voto.\n\n` +
           `*Evento:* ${evento.name}\n\n` +
           `Si votaste y aún no has reportado tu asistencia, puedes hacerlo con el comando /asistencia\n\n` +
           `🇻🇪 ¡Gracias por tu participación!`;
  }

  /**
   * Personaliza un mensaje de notificación para un participante específico
   * @param {Object} participante - Participante al que se enviará la notificación
   * @param {string} messageTemplate - Plantilla del mensaje
   * @returns {Promise<string>} - Mensaje personalizado
   */
  async personalizeMessage(participante, messageTemplate) {
    try {
      // Si no hay participante, devolver la plantilla original
      if (!participante) {
        return messageTemplate;
      }

      // Buscar información del centro de votación del participante
      const registro = await RegistroElectoral.findOne({
        where: { cedula: participante.cedula.toString() },
        include: [{ model: CentroVotacion, required: false }]
      });

      // Si no se encuentra registro o centro, devolver la plantilla original
      if (!registro || !registro.CentroVotacion) {
        return messageTemplate;
      }

      // Buscar información geográfica
      const geografia = await Geografia.findOne({
        where: {
          cod_estado: registro.cod_estado,
          cod_municipio: registro.cod_municipio,
          cod_parroquia: registro.cod_parroquia
        }
      });

      // Construir información personalizada del centro
      const centro = registro.CentroVotacion;
      const nombreEstado = geografia ? geografia.nom_estado : 'No disponible';
      const nombreMunicipio = geografia ? geografia.nom_municipio : 'No disponible';
      const nombreParroquia = geografia ? geografia.nom_parroquia : 'No disponible';

      // Generar enlace a Google Maps si hay coordenadas
      let enlaceMapa = '';
      if (centro.latitud && centro.longitud) {
        enlaceMapa = `https://www.google.com/maps?q=${centro.latitud},${centro.longitud}`;
      } else {
        // Si no hay coordenadas, generar enlace con la dirección
        const consulta = encodeURIComponent(`${centro.nom_centro}, ${centro.direccion}, ${nombreMunicipio}, ${nombreEstado}, Venezuela`);
        enlaceMapa = `https://www.google.com/maps/search/?api=1&query=${consulta}`;
      }

      // Información personalizada del centro
      const infoCentro = `\n\n📍 *Tu centro de votación:*\n` +
                       `*${centro.nom_centro}*\n` +
                       `Dirección: ${centro.direccion}\n` +
                       `Parroquia: ${nombreParroquia}\n` +
                       `Municipio: ${nombreMunicipio}\n` +
                       `Estado: ${nombreEstado}\n\n` +
                       `Ver ubicación: ${enlaceMapa}`;

      // Añadir información personalizada al final del mensaje
      return messageTemplate + infoCentro;
    } catch (error) {
      console.error('Error al personalizar mensaje:', error);
      return messageTemplate; // En caso de error, devolver la plantilla original
    }
  }

  /**
   * Envía todas las notificaciones pendientes que estén programadas para ahora o antes
   * @param {boolean} forceAll - Si es true, envía todas las notificaciones pendientes sin importar la fecha
   * @returns {Promise<number>} - Número de notificaciones enviadas
   */
  async sendPendingNotifications(forceAll = false) {
    try {
      // Buscar notificaciones pendientes
      const whereClause = {
        sent: false
      };
      
      // Si no estamos forzando el envío, solo enviar las que ya deberían haberse enviado
      if (!forceAll) {
        whereClause.scheduled_date = {
          [Op.lte]: new Date() // Menor o igual a la fecha actual
        };
      }
      
      const pendingNotifications = await NotificacionProgramada.findAll({
        where: whereClause,
        include: [{ model: Evento, required: true }],
        order: [['scheduled_date', 'ASC']]
      });
      
      console.log(`Encontradas ${pendingNotifications.length} notificaciones pendientes para enviar.`);
      
      let sentCount = 0;
      
      for (const notification of pendingNotifications) {
        try {
          // Obtener participantes para enviar la notificación
          const participantes = await Participante.findAll();
          
          if (participantes.length === 0) {
            console.log(`No hay participantes registrados para recibir la notificación ${notification.id}`);
            continue;
          }
          
          console.log(`Enviando notificación ${notification.id} (${notification.notification_type}) a ${participantes.length} participantes...`);
          
          // Enviar la notificación a cada participante
          for (const participante of participantes) {
            if (!participante.telegramId) {
              console.log(`El participante ${participante.id} no tiene Telegram ID, omitiendo...`);
              
              // Registrar estadística de error
              await NotificacionEstadistica.create({
                notification_id: notification.id,
                participant_id: participante.id,
                sent: false,
                error_message: 'El participante no tiene Telegram ID'
              });
              
              continue;
            }
            
            try {
              // Crear registro de estadística
              const estadistica = await NotificacionEstadistica.create({
                notification_id: notification.id,
                participant_id: participante.id,
                sent: false
              });
              
              // Personalizar el mensaje para este participante
              const personalizedMessage = await this.personalizeMessage(
                participante, 
                notification.message_template
              );
              
              // Enviar el mensaje personalizado
              const result = await this.bot.sendMessage(
                participante.telegramId,
                personalizedMessage,
                { parse_mode: 'Markdown' }
              );
              
              // Actualizar estadística como enviada
              estadistica.sent = true;
              estadistica.sent_date = new Date();
              estadistica.delivered = true; // Asumimos entrega inmediata en Telegram
              estadistica.delivered_date = new Date();
              await estadistica.save();
              
              console.log(`Notificación enviada a participante ${participante.id} (Telegram ID: ${participante.telegramId})`);
            } catch (error) {
              console.error(`Error al enviar notificación a participante ${participante.id}:`, error.message);
              
              // Registrar error en estadísticas
              await NotificacionEstadistica.create({
                notification_id: notification.id,
                participant_id: participante.id,
                sent: false,
                error_message: error.message
              });
            }
          }
          
          // Marcar la notificación como enviada
          notification.sent = true;
          notification.sent_date = new Date();
          await notification.save();
          
          sentCount++;
        } catch (error) {
          console.error(`Error al procesar notificación ${notification.id}:`, error.message);
        }
      }
      
      return sentCount;
    } catch (error) {
      console.error('Error al enviar notificaciones pendientes:', error);
      throw error;
    }
  }

  /**
   * Inicia el servicio de notificaciones
   * @param {number} intervalMinutes - Intervalo en minutos para verificar notificaciones pendientes
   */
  startNotificationService(intervalMinutes = 5) {
    console.log(`Iniciando servicio de notificaciones con intervalo de ${intervalMinutes} minutos`);
    
    // Ejecutar inmediatamente al iniciar
    this.sendPendingNotifications().catch(error => {
      console.error('Error en el servicio de notificaciones:', error);
    });
    
    // Configurar intervalo
    const intervalMs = intervalMinutes * 60 * 1000;
    this.interval = setInterval(() => {
      this.sendPendingNotifications().catch(error => {
        console.error('Error en el servicio de notificaciones:', error);
      });
    }, intervalMs);
  }

  /**
   * Detiene el servicio de notificaciones
   */
  stopNotificationService() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('Servicio de notificaciones detenido');
    }
  }

  /**
   * Marca una notificación como leída para un participante
   * @param {number} participantId - ID del participante
   * @param {number} notificationId - ID de la notificación
   * @returns {Promise<boolean>} - true si se actualizó correctamente
   */
  async markAsRead(participantId, notificationId) {
    try {
      const estadistica = await NotificacionEstadistica.findOne({
        where: {
          notification_id: notificationId,
          participant_id: participantId
        }
      });
      
      if (!estadistica) {
        console.log(`No se encontró estadística para la notificación ${notificationId} y participante ${participantId}`);
        return false;
      }
      
      // Actualizar solo si no estaba marcada como leída
      if (!estadistica.read) {
        estadistica.read = true;
        estadistica.read_date = new Date();
        await estadistica.save();
        console.log(`Notificación ${notificationId} marcada como leída por participante ${participantId}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
      return false;
    }
  }
  
  /**
   * Marca una notificación como respondida por un participante
   * @param {number} participantId - ID del participante
   * @param {number} notificationId - ID de la notificación
   * @returns {Promise<boolean>} - true si se actualizó correctamente
   */
  async markAsResponded(participantId, notificationId) {
    try {
      const estadistica = await NotificacionEstadistica.findOne({
        where: {
          notification_id: notificationId,
          participant_id: participantId
        }
      });
      
      if (!estadistica) {
        console.log(`No se encontró estadística para la notificación ${notificationId} y participante ${participantId}`);
        return false;
      }
      
      // Actualizar solo si no estaba marcada como respondida
      if (!estadistica.responded) {
        estadistica.responded = true;
        estadistica.response_date = new Date();
        await estadistica.save();
        console.log(`Notificación ${notificationId} marcada como respondida por participante ${participantId}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error al marcar notificación como respondida:', error);
      return false;
    }
  }
  
  /**
   * Obtiene estadísticas de notificaciones para un evento
   * @param {number} eventId - ID del evento
   * @returns {Promise<Object>} - Estadísticas del evento
   */
  async getEventNotificationStats(eventId) {
    try {
      const { sequelize } = require('../database');
      
      // Consulta SQL para obtener estadísticas resumidas
      const [stats] = await sequelize.query(`
        SELECT
          n.id AS notification_id,
          n.notification_type,
          COUNT(ns.id) AS total_participants,
          SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END) AS sent_count,
          SUM(CASE WHEN ns.delivered THEN 1 ELSE 0 END) AS delivered_count,
          SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) AS read_count,
          SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) AS responded_count,
          ROUND((SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2) AS sent_percentage,
          ROUND((SUM(CASE WHEN ns.delivered THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2) AS delivered_percentage,
          ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2) AS read_percentage,
          ROUND((SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2) AS responded_percentage
        FROM
          notif_eventos_bot.scheduled_notifications n
        LEFT JOIN
          notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
        WHERE
          n.event_id = :eventId
        GROUP BY
          n.id, n.notification_type
        ORDER BY
          n.id
      `, {
        replacements: { eventId },
        type: sequelize.QueryTypes.SELECT
      });
      
      return stats;
    } catch (error) {
      console.error('Error al obtener estadísticas de notificaciones:', error);
      throw error;
    }
  }
}

module.exports = NotificationService; 