const { Sequelize } = require('sequelize');
const { Organizacion, Participante, Evento, Asistencia, NotificacionProgramada, NotificacionEstadistica } = require('./database');

// Función para generar estadísticas generales de una organización
const generarEstadisticasGenerales = async (organizationId) => {
  try {
    const { sequelize } = require('./database');
    
    // Obtener la organización
    const organizacion = await Organizacion.findByPk(organizationId);
    if (!organizacion) {
      throw new Error(`No se encontró la organización con ID ${organizationId}`);
    }
    
    // Estadísticas generales
    const [estadisticasGenerales] = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_participantes,
        COUNT(DISTINCT e.id) as total_eventos,
        COUNT(DISTINCT a.id) as total_asistencias,
        COUNT(DISTINCT n.id) as total_notificaciones,
        SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) as total_notificaciones_leidas,
        SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) as total_notificaciones_respondidas,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_lectura,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_respuesta
      FROM notif_eventos_bot.organizations o
      LEFT JOIN notif_eventos_bot.participants p ON o.id = p.organization_id
      LEFT JOIN notif_eventos_bot.events e ON o.id = e.organization_id
      LEFT JOIN notif_eventos_bot.attendances a ON e.id = a.eventid AND p.id = a.participantid
      LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
      LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id AND p.id = ns.participant_id
      WHERE o.id = :orgId
    `, {
      replacements: { orgId: organizationId }
    });
    
    // Estadísticas por evento
    const [estadisticasPorEvento] = await sequelize.query(`
      SELECT 
        e.id as event_id,
        e.name as event_name,
        e.date as event_date,
        COUNT(DISTINCT a.id) as total_asistencias,
        COUNT(DISTINCT n.id) as total_notificaciones,
        SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) as notificaciones_leidas,
        SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) as notificaciones_respondidas,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_lectura,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_respuesta
      FROM notif_eventos_bot.events e
      LEFT JOIN notif_eventos_bot.attendances a ON e.id = a.eventid
      LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
      LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
      WHERE e.organization_id = :orgId
      GROUP BY e.id, e.name, e.date
      ORDER BY e.date DESC
    `, {
      replacements: { orgId: organizationId }
    });
    
    // Estadísticas de participación por día
    const [estadisticasPorDia] = await sequelize.query(`
      SELECT 
        DATE_TRUNC('day', a.registeredat) as fecha,
        COUNT(DISTINCT a.id) as asistencias,
        COUNT(DISTINCT p.id) as participantes
      FROM notif_eventos_bot.attendances a
      JOIN notif_eventos_bot.events e ON a.eventid = e.id
      JOIN notif_eventos_bot.participants p ON a.participantid = p.id
      WHERE e.organization_id = :orgId
      GROUP BY DATE_TRUNC('day', a.registeredat)
      ORDER BY DATE_TRUNC('day', a.registeredat) DESC
      LIMIT 30
    `, {
      replacements: { orgId: organizationId }
    });
    
    // Estadísticas de notificaciones por tipo
    const [estadisticasPorTipoNotificacion] = await sequelize.query(`
      SELECT 
        n.notification_type,
        COUNT(DISTINCT n.id) as total,
        SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) as leidas,
        SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) as respondidas,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_lectura,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_respuesta
      FROM notif_eventos_bot.scheduled_notifications n
      JOIN notif_eventos_bot.events e ON n.event_id = e.id
      LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
      WHERE e.organization_id = :orgId
      GROUP BY n.notification_type
      ORDER BY COUNT(DISTINCT n.id) DESC
    `, {
      replacements: { orgId: organizationId }
    });
    
    // Devolver todas las estadísticas
    return {
      organizacion: {
        id: organizacion.id,
        nombre: organizacion.name,
        descripcion: organizacion.description
      },
      estadisticasGenerales: estadisticasGenerales[0] || {},
      estadisticasPorEvento,
      estadisticasPorDia,
      estadisticasPorTipoNotificacion
    };
  } catch (error) {
    console.error('Error al generar estadísticas generales:', error);
    throw error;
  }
};

// Función para generar estadísticas de un evento específico
const generarEstadisticasEvento = async (eventId, organizationId) => {
  try {
    const { sequelize } = require('./database');
    
    // Verificar que el evento pertenezca a la organización
    const evento = await Evento.findOne({
      where: { 
        id: eventId,
        organization_id: organizationId
      }
    });
    
    if (!evento) {
      throw new Error(`No se encontró el evento con ID ${eventId} para la organización ${organizationId}`);
    }
    
    // Estadísticas generales del evento
    const [estadisticasGenerales] = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT a.id) as total_asistencias,
        COUNT(DISTINCT p.id) as total_participantes,
        COUNT(DISTINCT n.id) as total_notificaciones,
        SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) as notificaciones_leidas,
        SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) as notificaciones_respondidas,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_lectura,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_respuesta
      FROM notif_eventos_bot.events e
      LEFT JOIN notif_eventos_bot.attendances a ON e.id = a.eventid
      LEFT JOIN notif_eventos_bot.participants p ON a.participantid = p.id
      LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
      LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
      WHERE e.id = :eventId
    `, {
      replacements: { eventId }
    });
    
    // Estadísticas de asistencia por hora
    const [estadisticasPorHora] = await sequelize.query(`
      SELECT 
        DATE_TRUNC('hour', a.registeredat) as hora,
        COUNT(DISTINCT a.id) as asistencias
      FROM notif_eventos_bot.attendances a
      WHERE a.eventid = :eventId
      GROUP BY DATE_TRUNC('hour', a.registeredat)
      ORDER BY DATE_TRUNC('hour', a.registeredat)
    `, {
      replacements: { eventId }
    });
    
    // Estadísticas de notificaciones por tipo
    const [estadisticasPorTipoNotificacion] = await sequelize.query(`
      SELECT 
        n.notification_type,
        COUNT(DISTINCT n.id) as total,
        SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) as leidas,
        SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) as respondidas,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_lectura,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_respuesta
      FROM notif_eventos_bot.scheduled_notifications n
      LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
      WHERE n.event_id = :eventId
      GROUP BY n.notification_type
    `, {
      replacements: { eventId }
    });
    
    // Devolver todas las estadísticas
    return {
      evento: {
        id: evento.id,
        nombre: evento.name,
        fecha: evento.date,
        ubicacion: evento.location
      },
      estadisticasGenerales: estadisticasGenerales[0] || {},
      estadisticasPorHora,
      estadisticasPorTipoNotificacion
    };
  } catch (error) {
    console.error('Error al generar estadísticas del evento:', error);
    throw error;
  }
};

// Función para generar un mensaje con las estadísticas de una organización
const generarMensajeEstadisticasOrganizacion = async (organizationId) => {
  try {
    const estadisticas = await generarEstadisticasGenerales(organizationId);
    
    // Formatear el mensaje
    let mensaje = `📊 *Estadísticas de ${estadisticas.organizacion.nombre}*\n\n`;
    
    // Estadísticas generales
    mensaje += `*Estadísticas generales:*\n`;
    mensaje += `👥 Participantes: ${estadisticas.estadisticasGenerales.total_participantes || 0}\n`;
    mensaje += `🗓️ Eventos: ${estadisticas.estadisticasGenerales.total_eventos || 0}\n`;
    mensaje += `✅ Asistencias: ${estadisticas.estadisticasGenerales.total_asistencias || 0}\n`;
    mensaje += `📨 Notificaciones: ${estadisticas.estadisticasGenerales.total_notificaciones || 0}\n`;
    mensaje += `👁️ Tasa de lectura: ${estadisticas.estadisticasGenerales.tasa_lectura || 0}%\n`;
    mensaje += `💬 Tasa de respuesta: ${estadisticas.estadisticasGenerales.tasa_respuesta || 0}%\n\n`;
    
    // Estadísticas por evento (últimos 3)
    if (estadisticas.estadisticasPorEvento && estadisticas.estadisticasPorEvento.length > 0) {
      mensaje += `*Últimos eventos:*\n`;
      
      const eventosRecientes = estadisticas.estadisticasPorEvento.slice(0, 3);
      
      for (const evento of eventosRecientes) {
        const fecha = new Date(evento.event_date).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        mensaje += `• *${evento.event_name}* (${fecha})\n`;
        mensaje += `  ✅ Asistencias: ${evento.total_asistencias || 0}\n`;
        mensaje += `  👁️ Tasa de lectura: ${evento.tasa_lectura || 0}%\n`;
      }
      
      mensaje += `\n`;
    }
    
    // Estadísticas por tipo de notificación
    if (estadisticas.estadisticasPorTipoNotificacion && estadisticas.estadisticasPorTipoNotificacion.length > 0) {
      mensaje += `*Tipos de notificación:*\n`;
      
      for (const tipo of estadisticas.estadisticasPorTipoNotificacion) {
        mensaje += `• *${tipo.notification_type}*\n`;
        mensaje += `  📨 Total: ${tipo.total || 0}\n`;
        mensaje += `  👁️ Tasa de lectura: ${tipo.tasa_lectura || 0}%\n`;
      }
    }
    
    return mensaje;
  } catch (error) {
    console.error('Error al generar mensaje de estadísticas:', error);
    return `❌ Error al generar estadísticas: ${error.message}`;
  }
};

// Exportar funciones
module.exports = {
  generarEstadisticasGenerales,
  generarEstadisticasEvento,
  generarMensajeEstadisticasOrganizacion
}; 