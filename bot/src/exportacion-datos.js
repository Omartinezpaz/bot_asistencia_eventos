const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { Organizacion, Participante, Evento, Asistencia, NotificacionProgramada, NotificacionEstadistica } = require('./database');

// Función para generar un reporte de eventos y asistencias por organización en Excel
const generarReporteEventosExcel = async (organizationId) => {
  try {
    // Verificar que la organización existe
    const organizacion = await Organizacion.findByPk(organizationId);
    if (!organizacion) {
      throw new Error(`No se encontró la organización con ID ${organizationId}`);
    }

    // Crear un nuevo libro de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bot de Notificación de Eventos';
    workbook.lastModifiedBy = 'Sistema Automatizado';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Hoja de información general
    const infoSheet = workbook.addWorksheet('Información General');
    infoSheet.columns = [
      { header: 'Propiedad', key: 'propiedad', width: 30 },
      { header: 'Valor', key: 'valor', width: 50 }
    ];

    // Añadir información general de la organización
    infoSheet.addRows([
      { propiedad: 'Nombre de la Organización', valor: organizacion.name },
      { propiedad: 'Descripción', valor: organizacion.description || 'N/A' },
      { propiedad: 'Correo de Contacto', valor: organizacion.contact_email || 'N/A' },
      { propiedad: 'Teléfono de Contacto', valor: organizacion.contact_phone || 'N/A' },
      { propiedad: 'Estado', valor: organizacion.active ? 'Activa' : 'Inactiva' },
      { propiedad: 'Fecha de Creación', valor: organizacion.createdAt.toLocaleString() },
      { propiedad: 'Fecha de Reporte', valor: new Date().toLocaleString() }
    ]);

    // Aplicar estilos a la hoja de información
    infoSheet.getRow(1).font = { bold: true };
    infoSheet.getColumn('propiedad').font = { bold: true };

    // Hoja de participantes
    const participantesSheet = workbook.addWorksheet('Participantes');
    participantesSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Teléfono', key: 'telefono', width: 15 },
      { header: 'Telegram ID', key: 'telegramId', width: 15 },
      { header: 'Usuario Telegram', key: 'username', width: 20 },
      { header: 'Rol', key: 'rol', width: 10 },
      { header: 'Fecha de Registro', key: 'fechaRegistro', width: 20 }
    ];

    // Obtener participantes de la organización
    const participantes = await Participante.findAll({
      where: { organization_id: organizationId },
      order: [['id', 'ASC']]
    });

    // Añadir participantes a la hoja
    participantes.forEach(p => {
      participantesSheet.addRow({
        id: p.id,
        cedula: `${p.nac}-${p.cedula}`,
        nombre: p.firstName,
        apellido: p.lastName,
        telefono: p.phone || 'N/A',
        telegramId: p.telegramId,
        username: p.username || 'N/A',
        rol: p.rol || 'user',
        fechaRegistro: p.createdAt.toLocaleString()
      });
    });

    // Aplicar estilos a la hoja de participantes
    participantesSheet.getRow(1).font = { bold: true };

    // Hoja de eventos
    const eventosSheet = workbook.addWorksheet('Eventos');
    eventosSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Ubicación', key: 'ubicacion', width: 30 },
      { header: 'Estado', key: 'estado', width: 10 },
      { header: 'Notificaciones', key: 'notificaciones', width: 15 },
      { header: 'Total Asistencias', key: 'totalAsistencias', width: 15 }
    ];

    // Obtener eventos de la organización
    const eventos = await Evento.findAll({
      where: { organization_id: organizationId },
      order: [['date', 'DESC']]
    });

    // Añadir eventos a la hoja
    for (const evento of eventos) {
      // Contar asistencias para este evento
      const totalAsistencias = await Asistencia.count({
        where: { eventid: evento.id }
      });

      eventosSheet.addRow({
        id: evento.id,
        nombre: evento.name,
        descripcion: evento.description || 'N/A',
        fecha: evento.date.toLocaleString(),
        ubicacion: evento.location || 'N/A',
        estado: evento.active ? 'Activo' : 'Inactivo',
        notificaciones: evento.notification_enabled ? 'Habilitadas' : 'Deshabilitadas',
        totalAsistencias: totalAsistencias
      });
    }

    // Aplicar estilos a la hoja de eventos
    eventosSheet.getRow(1).font = { bold: true };

    // Hoja de asistencias
    const asistenciasSheet = workbook.addWorksheet('Asistencias');
    asistenciasSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Evento', key: 'evento', width: 30 },
      { header: 'Participante', key: 'participante', width: 30 },
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Fecha de Registro', key: 'fechaRegistro', width: 20 }
    ];

    // Obtener todas las asistencias de eventos de la organización
    const [asistencias] = await sequelize.query(`
      SELECT 
        a.id, 
        e.name as event_name, 
        p.firstName || ' ' || p.lastName as participant_name,
        p.nac || '-' || p.cedula as cedula,
        a.status, 
        a.registeredat
      FROM notif_eventos_bot.attendances a
      JOIN notif_eventos_bot.events e ON a.eventid = e.id
      JOIN notif_eventos_bot.participants p ON a.participantid = p.id
      WHERE e.organization_id = :orgId
      ORDER BY a.registeredat DESC
    `, {
      replacements: { orgId: organizationId }
    });

    // Añadir asistencias a la hoja
    asistencias.forEach(a => {
      asistenciasSheet.addRow({
        id: a.id,
        evento: a.event_name,
        participante: a.participant_name,
        cedula: a.cedula,
        estado: a.status,
        fechaRegistro: new Date(a.registeredat).toLocaleString()
      });
    });

    // Aplicar estilos a la hoja de asistencias
    asistenciasSheet.getRow(1).font = { bold: true };

    // Hoja de estadísticas
    const estadisticasSheet = workbook.addWorksheet('Estadísticas');
    estadisticasSheet.columns = [
      { header: 'Métrica', key: 'metrica', width: 40 },
      { header: 'Valor', key: 'valor', width: 15 }
    ];

    // Obtener estadísticas
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_participantes,
        COUNT(DISTINCT e.id) as total_eventos,
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
      FROM notif_eventos_bot.organizations o
      LEFT JOIN notif_eventos_bot.participants p ON o.id = p.organization_id
      LEFT JOIN notif_eventos_bot.events e ON o.id = e.organization_id
      LEFT JOIN notif_eventos_bot.attendances a ON e.id = a.eventid
      LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
      LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
      WHERE o.id = :orgId
    `, {
      replacements: { orgId: organizationId }
    });

    // Añadir estadísticas a la hoja
    const statsData = stats[0] || {};
    estadisticasSheet.addRows([
      { metrica: 'Total de Participantes', valor: statsData.total_participantes || 0 },
      { metrica: 'Total de Eventos', valor: statsData.total_eventos || 0 },
      { metrica: 'Total de Asistencias', valor: statsData.total_asistencias || 0 },
      { metrica: 'Total de Notificaciones', valor: statsData.total_notificaciones || 0 },
      { metrica: 'Notificaciones Leídas', valor: statsData.notificaciones_leidas || 0 },
      { metrica: 'Notificaciones Respondidas', valor: statsData.notificaciones_respondidas || 0 },
      { metrica: 'Tasa de Lectura (%)', valor: statsData.tasa_lectura || 0 },
      { metrica: 'Tasa de Respuesta (%)', valor: statsData.tasa_respuesta || 0 }
    ]);

    // Aplicar estilos a la hoja de estadísticas
    estadisticasSheet.getRow(1).font = { bold: true };
    estadisticasSheet.getColumn('metrica').font = { bold: true };

    // Crear directorio para reportes si no existe
    const reportesDir = path.join(__dirname, '../reportes');
    if (!fs.existsSync(reportesDir)) {
      fs.mkdirSync(reportesDir, { recursive: true });
    }

    // Generar nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nombreArchivo = `reporte_${organizacion.name.replace(/\s+/g, '_').toLowerCase()}_${timestamp}.xlsx`;
    const rutaArchivo = path.join(reportesDir, nombreArchivo);

    // Guardar el archivo
    await workbook.xlsx.writeFile(rutaArchivo);

    return {
      nombreArchivo,
      rutaArchivo,
      organizacion: organizacion.name
    };
  } catch (error) {
    console.error('Error al generar reporte Excel:', error);
    throw error;
  }
};

// Función para generar estadísticas comparativas entre organizaciones
const generarEstadisticasComparativas = async () => {
  try {
    // Obtener todas las organizaciones activas
    const organizaciones = await Organizacion.findAll({
      where: { active: true },
      order: [['name', 'ASC']]
    });

    if (organizaciones.length === 0) {
      throw new Error('No hay organizaciones activas para comparar');
    }

    // Crear un nuevo libro de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bot de Notificación de Eventos';
    workbook.lastModifiedBy = 'Sistema Automatizado';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Hoja de información general
    const infoSheet = workbook.addWorksheet('Información');
    infoSheet.columns = [
      { header: 'Propiedad', key: 'propiedad', width: 30 },
      { header: 'Valor', key: 'valor', width: 50 }
    ];

    // Añadir información general del reporte
    infoSheet.addRows([
      { propiedad: 'Tipo de Reporte', valor: 'Estadísticas Comparativas entre Organizaciones' },
      { propiedad: 'Fecha de Generación', valor: new Date().toLocaleString() },
      { propiedad: 'Total de Organizaciones', valor: organizaciones.length }
    ]);

    // Aplicar estilos a la hoja de información
    infoSheet.getRow(1).font = { bold: true };
    infoSheet.getColumn('propiedad').font = { bold: true };

    // Hoja de comparativa general
    const comparativaSheet = workbook.addWorksheet('Comparativa General');
    
    // Definir columnas
    comparativaSheet.columns = [
      { header: 'Organización', key: 'organizacion', width: 30 },
      { header: 'Participantes', key: 'participantes', width: 15 },
      { header: 'Eventos', key: 'eventos', width: 15 },
      { header: 'Asistencias', key: 'asistencias', width: 15 },
      { header: 'Tasa de Asistencia (%)', key: 'tasaAsistencia', width: 20 },
      { header: 'Notificaciones', key: 'notificaciones', width: 15 },
      { header: 'Tasa de Lectura (%)', key: 'tasaLectura', width: 20 },
      { header: 'Tasa de Respuesta (%)', key: 'tasaRespuesta', width: 20 }
    ];

    // Obtener estadísticas para cada organización
    for (const org of organizaciones) {
      const [stats] = await sequelize.query(`
        SELECT 
          COUNT(DISTINCT p.id) as total_participantes,
          COUNT(DISTINCT e.id) as total_eventos,
          COUNT(DISTINCT a.id) as total_asistencias,
          COUNT(DISTINCT n.id) as total_notificaciones,
          CASE 
            WHEN COUNT(DISTINCT p.id) > 0 AND COUNT(DISTINCT e.id) > 0 THEN 
              ROUND((COUNT(DISTINCT a.id)::numeric / (COUNT(DISTINCT p.id) * COUNT(DISTINCT e.id))::numeric) * 100, 2)
            ELSE 0
          END AS tasa_asistencia,
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
        LEFT JOIN notif_eventos_bot.attendances a ON e.id = a.eventid
        LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
        LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
        WHERE o.id = :orgId
      `, {
        replacements: { orgId: org.id }
      });

      const orgStats = stats[0] || {};
      
      // Añadir fila con estadísticas de la organización
      comparativaSheet.addRow({
        organizacion: org.name,
        participantes: orgStats.total_participantes || 0,
        eventos: orgStats.total_eventos || 0,
        asistencias: orgStats.total_asistencias || 0,
        tasaAsistencia: orgStats.tasa_asistencia || 0,
        notificaciones: orgStats.total_notificaciones || 0,
        tasaLectura: orgStats.tasa_lectura || 0,
        tasaRespuesta: orgStats.tasa_respuesta || 0
      });
    }

    // Aplicar estilos a la hoja comparativa
    comparativaSheet.getRow(1).font = { bold: true };

    // Hoja de eventos por organización
    const eventosSheet = workbook.addWorksheet('Eventos por Organización');
    eventosSheet.columns = [
      { header: 'Organización', key: 'organizacion', width: 30 },
      { header: 'ID Evento', key: 'idEvento', width: 10 },
      { header: 'Nombre Evento', key: 'nombreEvento', width: 30 },
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Total Asistencias', key: 'asistencias', width: 15 },
      { header: 'Notificaciones Enviadas', key: 'notificaciones', width: 20 },
      { header: 'Tasa de Lectura (%)', key: 'tasaLectura', width: 20 }
    ];

    // Obtener eventos para todas las organizaciones
    const [todosEventos] = await sequelize.query(`
      SELECT 
        o.id as org_id,
        o.name as org_name,
        e.id as event_id,
        e.name as event_name,
        e.date as event_date,
        COUNT(DISTINCT a.id) as total_asistencias,
        COUNT(DISTINCT n.id) as total_notificaciones,
        CASE 
          WHEN COUNT(ns.id) > 0 THEN 
            ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
          ELSE 0
        END AS tasa_lectura
      FROM notif_eventos_bot.organizations o
      JOIN notif_eventos_bot.events e ON o.id = e.organization_id
      LEFT JOIN notif_eventos_bot.attendances a ON e.id = a.eventid
      LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
      LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
      WHERE o.active = true
      GROUP BY o.id, o.name, e.id, e.name, e.date
      ORDER BY o.name, e.date DESC
    `);

    // Añadir eventos a la hoja
    todosEventos.forEach(e => {
      eventosSheet.addRow({
        organizacion: e.org_name,
        idEvento: e.event_id,
        nombreEvento: e.event_name,
        fecha: new Date(e.event_date).toLocaleString(),
        asistencias: e.total_asistencias || 0,
        notificaciones: e.total_notificaciones || 0,
        tasaLectura: e.tasa_lectura || 0
      });
    });

    // Aplicar estilos a la hoja de eventos
    eventosSheet.getRow(1).font = { bold: true };

    // Crear directorio para reportes si no existe
    const reportesDir = path.join(__dirname, '../reportes');
    if (!fs.existsSync(reportesDir)) {
      fs.mkdirSync(reportesDir, { recursive: true });
    }

    // Generar nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nombreArchivo = `comparativa_organizaciones_${timestamp}.xlsx`;
    const rutaArchivo = path.join(reportesDir, nombreArchivo);

    // Guardar el archivo
    await workbook.xlsx.writeFile(rutaArchivo);

    return {
      nombreArchivo,
      rutaArchivo,
      totalOrganizaciones: organizaciones.length
    };
  } catch (error) {
    console.error('Error al generar estadísticas comparativas:', error);
    throw error;
  }
};

// Comando para generar reporte de una organización
const generarReporteCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario es administrador
    const { verificarAdminOrganizacion, verificarSuperAdmin } = require('./organizacion-commands');
    
    // Obtener argumentos del comando: /generar_reporte [id_organizacion]
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    let organizationId = null;
    
    // Si se especifica un ID de organización, verificar que sea super admin o admin de esa organización
    if (args.length > 1) {
      organizationId = parseInt(args[1]);
      
      if (isNaN(organizationId)) {
        return ctx.replyWithMarkdown(
          `❌ *ID de organización inválido*\n\n` +
          `Por favor, proporciona un ID de organización válido.`
        );
      }
      
      // Verificar permisos
      const esSuperAdmin = await verificarSuperAdmin(telegramId);
      const esAdmin = await verificarAdminOrganizacion(telegramId, organizationId);
      
      if (!esSuperAdmin && !esAdmin) {
        return ctx.replyWithMarkdown(
          `❌ *Acceso denegado*\n\n` +
          `No tienes permisos para generar reportes de esta organización.`
        );
      }
    } else {
      // Si no se especifica organización, buscar la del usuario
      const participante = await Participante.findOne({ 
        where: { telegramId } 
      });
      
      if (!participante || !participante.organization_id) {
        return ctx.replyWithMarkdown(
          `❌ *Error*\n\n` +
          `No perteneces a ninguna organización o no se especificó un ID de organización válido.`,
          Markup.inlineKeyboard([
            Markup.button.callback('🏠 Menú principal', 'action_main_menu')
          ])
        );
      }
      
      organizationId = participante.organization_id;
      
      // Verificar que sea admin de su organización
      const esAdmin = await verificarAdminOrganizacion(telegramId, organizationId);
      if (!esAdmin) {
        return ctx.replyWithMarkdown(
          `❌ *Acceso denegado*\n\n` +
          `Solo los administradores pueden generar reportes de la organización.`
        );
      }
    }
    
    // Enviar mensaje de espera
    await ctx.replyWithMarkdown(
      `🔄 *Generando reporte*\n\n` +
      `Estamos generando el reporte de la organización. Este proceso puede tardar unos momentos...`
    );
    
    // Generar el reporte
    const resultado = await generarReporteEventosExcel(organizationId);
    
    // Enviar el archivo
    await ctx.replyWithDocument({ 
      source: resultado.rutaArchivo,
      filename: resultado.nombreArchivo
    }, {
      caption: `📊 Reporte de ${resultado.organizacion} generado exitosamente.\n\nFecha: ${new Date().toLocaleString()}`
    });
    
  } catch (error) {
    console.error('Error en comando generar_reporte:', error);
    await ctx.reply(
      'Ocurrió un error al generar el reporte. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando para generar estadísticas comparativas entre organizaciones
const generarComparativaCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario es super administrador
    const { verificarSuperAdmin } = require('./organizacion-commands');
    const esSuperAdmin = await verificarSuperAdmin(telegramId);
    
    if (!esSuperAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para super administradores.`
      );
    }
    
    // Enviar mensaje de espera
    await ctx.replyWithMarkdown(
      `🔄 *Generando estadísticas comparativas*\n\n` +
      `Estamos generando las estadísticas comparativas entre organizaciones. Este proceso puede tardar unos momentos...`
    );
    
    // Generar el reporte
    const resultado = await generarEstadisticasComparativas();
    
    // Enviar el archivo
    await ctx.replyWithDocument({ 
      source: resultado.rutaArchivo,
      filename: resultado.nombreArchivo
    }, {
      caption: `📊 Estadísticas comparativas de ${resultado.totalOrganizaciones} organizaciones generadas exitosamente.\n\nFecha: ${new Date().toLocaleString()}`
    });
    
  } catch (error) {
    console.error('Error en comando generar_comparativa:', error);
    await ctx.reply(
      'Ocurrió un error al generar las estadísticas comparativas. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

module.exports = {
  generarReporteEventosExcel,
  generarEstadisticasComparativas,
  generarReporteCommand,
  generarComparativaCommand
}; 