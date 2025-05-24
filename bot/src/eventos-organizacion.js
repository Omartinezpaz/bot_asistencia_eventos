const { Markup } = require('telegraf');
const { Organizacion, Participante, OrganizacionAdmin, Evento, Asistencia } = require('./database');
const { Op } = require('sequelize');

// Función para iniciar el proceso de creación de un evento para una organización
const iniciarCreacionEvento = async (ctx, organizationId) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario es administrador de la organización
    const { verificarAdminOrganizacion } = require('./organizacion-commands');
    const esAdmin = await verificarAdminOrganizacion(telegramId, organizationId);
    
    if (!esAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Solo los administradores pueden crear eventos para esta organización.`
      );
    }
    
    // Obtener información de la organización
    const organizacion = await Organizacion.findByPk(organizationId);
    if (!organizacion) {
      return ctx.replyWithMarkdown(
        `❌ *Error*\n\n` +
        `No se encontró la organización con ID ${organizationId}.`
      );
    }
    
    // Inicializar la sesión si no existe
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Iniciar el proceso de creación
    ctx.session.creandoEvento = true;
    ctx.session.eventoStep = 'nombre';
    ctx.session.organizationId = organizationId;
    ctx.session.nuevoEvento = { organization_id: organizationId };
    
    await ctx.replyWithMarkdown(
      `🗓️ *Creación de nuevo evento para ${organizacion.name}*\n\n` +
      `Por favor, ingresa el nombre del evento:`
    );
  } catch (error) {
    console.error('Error al iniciar creación de evento:', error);
    await ctx.reply(
      'Ocurrió un error al iniciar la creación del evento. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔙 Volver', 'action_organizaciones'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Función para manejar las respuestas durante el proceso de creación de evento
const handleEventoResponse = async (ctx) => {
  try {
    // Inicializar la sesión si no existe
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Si no hay un proceso de creación activo, ignorar el mensaje
    if (!ctx.session.creandoEvento || !ctx.session.eventoStep) {
      return;
    }
    
    const texto = ctx.message.text.trim();
    
    // Procesamiento según el paso actual
    switch (ctx.session.eventoStep) {
      // Paso 1: Nombre
      case 'nombre':
        if (texto.length < 3 || texto.length > 100) {
          await ctx.reply('El nombre debe tener entre 3 y 100 caracteres. Por favor, intenta nuevamente:');
          return;
        }
        
        ctx.session.nuevoEvento.name = texto;
        ctx.session.eventoStep = 'descripcion';
        
        await ctx.replyWithMarkdown(
          `✅ *Nombre registrado:* ${texto}\n\n` +
          `Ahora, ingresa una descripción para el evento (opcional, puedes enviar "-" para omitir):`
        );
        break;
        
      // Paso 2: Descripción
      case 'descripcion':
        if (texto !== '-') {
          ctx.session.nuevoEvento.description = texto;
        }
        
        ctx.session.eventoStep = 'fecha';
        
        await ctx.replyWithMarkdown(
          `✅ *Descripción registrada*\n\n` +
          `Ahora, ingresa la fecha y hora del evento en formato DD/MM/YYYY HH:MM\n` +
          `Ejemplo: 25/12/2023 15:30`
        );
        break;
        
      // Paso 3: Fecha
      case 'fecha':
        // Validar formato de fecha
        const fechaRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{1,2})$/;
        const match = texto.match(fechaRegex);
        
        if (!match) {
          await ctx.reply('El formato de fecha es incorrecto. Por favor, usa el formato DD/MM/YYYY HH:MM (ejemplo: 25/12/2023 15:30):');
          return;
        }
        
        const [, dia, mes, anio, hora, minuto] = match;
        const fecha = new Date(anio, mes - 1, dia, hora, minuto);
        
        // Validar que la fecha sea futura
        if (fecha <= new Date()) {
          await ctx.reply('La fecha debe ser futura. Por favor, ingresa una fecha posterior a la actual:');
          return;
        }
        
        ctx.session.nuevoEvento.date = fecha;
        ctx.session.eventoStep = 'ubicacion';
        
        await ctx.replyWithMarkdown(
          `✅ *Fecha registrada:* ${fecha.toLocaleString()}\n\n` +
          `Ahora, ingresa la ubicación del evento:`
        );
        break;
        
      // Paso 4: Ubicación
      case 'ubicacion':
        if (texto.length < 3 || texto.length > 200) {
          await ctx.reply('La ubicación debe tener entre 3 y 200 caracteres. Por favor, intenta nuevamente:');
          return;
        }
        
        ctx.session.nuevoEvento.location = texto;
        ctx.session.eventoStep = 'notificaciones';
        
        await ctx.replyWithMarkdown(
          `✅ *Ubicación registrada*\n\n` +
          `¿Deseas habilitar notificaciones automáticas para este evento?\n` +
          `Responde "si" o "no":`
        );
        break;
        
      // Paso 5: Notificaciones
      case 'notificaciones':
        const respuesta = texto.toLowerCase();
        
        if (respuesta !== 'si' && respuesta !== 'no') {
          await ctx.reply('Por favor, responde "si" o "no":');
          return;
        }
        
        ctx.session.nuevoEvento.notification_enabled = (respuesta === 'si');
        
        if (respuesta === 'si') {
          ctx.session.eventoStep = 'horas_notificacion';
          
          await ctx.replyWithMarkdown(
            `✅ *Notificaciones habilitadas*\n\n` +
            `¿Cuántas horas antes del evento deseas que se envíen las notificaciones?\n` +
            `Ingresa un número entre 1 y 72:`
          );
        } else {
          // Si no hay notificaciones, pasar directamente a guardar el evento
          ctx.session.nuevoEvento.notification_hours_before = 24; // Valor por defecto
          await guardarEvento(ctx);
        }
        break;
        
      // Paso 6: Horas de notificación
      case 'horas_notificacion':
        const horas = parseInt(texto);
        
        if (isNaN(horas) || horas < 1 || horas > 72) {
          await ctx.reply('Por favor, ingresa un número válido entre 1 y 72:');
          return;
        }
        
        ctx.session.nuevoEvento.notification_hours_before = horas;
        
        // Guardar el evento
        await guardarEvento(ctx);
        break;
        
      default:
        // Estado desconocido, reiniciar proceso
        delete ctx.session.creandoEvento;
        delete ctx.session.eventoStep;
        delete ctx.session.nuevoEvento;
        delete ctx.session.organizationId;
        await ctx.reply('Ocurrió un error en el proceso de creación. Por favor, intenta nuevamente.');
    }
  } catch (error) {
    console.error('Error en procesamiento de respuesta de evento:', error);
    await ctx.reply('Ocurrió un error al procesar tu respuesta. Por favor, intenta nuevamente.');
    
    // Limpiar la sesión en caso de error
    if (ctx.session) {
      delete ctx.session.creandoEvento;
      delete ctx.session.eventoStep;
      delete ctx.session.nuevoEvento;
      delete ctx.session.organizationId;
    }
  }
};

// Función auxiliar para guardar el evento en la base de datos
const guardarEvento = async (ctx) => {
  try {
    // Crear el evento en la base de datos
    const nuevoEvento = await Evento.create({
      name: ctx.session.nuevoEvento.name,
      description: ctx.session.nuevoEvento.description || '',
      date: ctx.session.nuevoEvento.date,
      location: ctx.session.nuevoEvento.location,
      active: true,
      notification_enabled: ctx.session.nuevoEvento.notification_enabled,
      notification_hours_before: ctx.session.nuevoEvento.notification_hours_before,
      organization_id: ctx.session.organizationId
    });
    
    // Obtener información de la organización
    const organizacion = await Organizacion.findByPk(ctx.session.organizationId);
    
    // Programar notificaciones si están habilitadas
    if (nuevoEvento.notification_enabled) {
      try {
        const NotificationService = require('./services/notification-service');
        const notificationService = new NotificationService(ctx.telegram);
        await notificationService.scheduleAutomaticNotifications(nuevoEvento.id);
      } catch (notifError) {
        console.error('Error al programar notificaciones:', notifError);
      }
    }
    
    await ctx.replyWithMarkdown(
      `🎉 *¡Evento creado exitosamente!*\n\n` +
      `*Nombre:* ${nuevoEvento.name}\n` +
      `*Fecha:* ${nuevoEvento.date.toLocaleString()}\n` +
      `*Ubicación:* ${nuevoEvento.location}\n` +
      `*Organización:* ${organizacion.name}\n` +
      `*Notificaciones:* ${nuevoEvento.notification_enabled ? 'Habilitadas' : 'Deshabilitadas'}\n\n` +
      `El evento ha sido registrado correctamente y está listo para recibir asistentes.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Ver eventos de la organización', `org_events_${ctx.session.organizationId}`)],
        [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
      ])
    );
    
    // Limpiar la sesión
    delete ctx.session.creandoEvento;
    delete ctx.session.eventoStep;
    delete ctx.session.nuevoEvento;
    delete ctx.session.organizationId;
  } catch (error) {
    console.error('Error al guardar evento:', error);
    await ctx.reply('Ocurrió un error al crear el evento. Por favor, intenta nuevamente más tarde.');
    
    // Limpiar la sesión en caso de error
    if (ctx.session) {
      delete ctx.session.creandoEvento;
      delete ctx.session.eventoStep;
      delete ctx.session.nuevoEvento;
      delete ctx.session.organizationId;
    }
  }
};

// Función para mostrar eventos filtrados por organización
const mostrarEventosPorOrganizacion = async (ctx, organizationId) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario está registrado
    const participante = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    if (!participante) {
      return ctx.replyWithMarkdown(
        `❌ *No estás registrado*\n\n` +
        `Para ver los eventos disponibles, primero debes registrarte.`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Registrarme ahora', 'action_register'),
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Verificar que la organización existe
    const organizacion = await Organizacion.findByPk(organizationId);
    if (!organizacion) {
      return ctx.replyWithMarkdown(
        `❌ *Organización no encontrada*\n\n` +
        `No se encontró la organización con ID ${organizationId}.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔙 Volver', 'action_organizaciones'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
    
    // Buscar eventos activos de la organización
    const eventos = await Evento.findAll({ 
      where: { 
        active: true,
        organization_id: organizationId
      },
      order: [['date', 'ASC']]
    });
    
    if (eventos.length === 0) {
      return ctx.replyWithMarkdown(
        `ℹ️ *No hay eventos disponibles para ${organizacion.name}*\n\n` +
        `No se encontraron eventos activos para esta organización.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔙 Volver', 'action_mi_organizacion'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
    
    // Construir mensaje con la lista de eventos
    let mensaje = `📆 *Eventos de ${organizacion.name}*\n\n`;
    
    // Botones para cada evento
    const botonesEventos = [];
    
    for (const evento of eventos) {
      const fecha = new Date(evento.date).toLocaleDateString('es-ES', {
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Verificar si el usuario ya registró asistencia a este evento
      const asistencia = await Asistencia.findOne({
        where: {
          participantid: participante.id,
          eventid: evento.id
        }
      });
      
      const estadoAsistencia = asistencia 
        ? '✅ *Asistencia registrada*' 
        : '⏳ *Pendiente*';
      
      mensaje += `*${evento.name}*\n` +
                 `📝 ${evento.description}\n` +
                 `🗓️ ${fecha}\n` +
                 `📍 ${evento.location}\n` +
                 `📊 Estado: ${estadoAsistencia}\n\n`;
      
      // Añadir botón para registrar asistencia si aún no lo ha hecho
      if (!asistencia) {
        botonesEventos.push([
          Markup.button.callback(`✅ Asistir a ${evento.name}`, `event_${evento.id}`)
        ]);
      }
    }
    
    // Verificar si el usuario es administrador para mostrar opción de crear evento
    const { verificarAdminOrganizacion } = require('./organizacion-commands');
    const esAdmin = await verificarAdminOrganizacion(telegramId, organizationId);
    
    if (esAdmin) {
      botonesEventos.push([
        Markup.button.callback('➕ Crear nuevo evento', `create_event_${organizationId}`)
      ]);
    }
    
    // Añadir botones de navegación
    botonesEventos.push([
      Markup.button.callback('🔙 Volver', 'action_mi_organizacion'),
      Markup.button.callback('🏠 Menú principal', 'action_main_menu')
    ]);
    
    await ctx.replyWithMarkdown(
      mensaje,
      Markup.inlineKeyboard(botonesEventos)
    );
  } catch (error) {
    console.error('Error al mostrar eventos por organización:', error);
    await ctx.reply(
      'Ocurrió un error al consultar los eventos. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', `org_events_${organizationId}`),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando para ver eventos de mi organización
const misEventosCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Buscar el participante
    const participante = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    if (!participante) {
      return ctx.replyWithMarkdown(
        `❌ *No estás registrado*\n\n` +
        `Para ver los eventos de tu organización, primero debes registrarte.`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Registrarme ahora', 'action_register'),
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Verificar si pertenece a una organización
    if (!participante.organization_id) {
      return ctx.replyWithMarkdown(
        `ℹ️ *No perteneces a ninguna organización*\n\n` +
        `Contacta al administrador del sistema para que te asigne a una organización.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Mostrar eventos de la organización
    return mostrarEventosPorOrganizacion(ctx, participante.organization_id);
  } catch (error) {
    console.error('Error en comando mis_eventos:', error);
    await ctx.reply(
      'Ocurrió un error al consultar los eventos de tu organización. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_mis_eventos'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Exportar las funciones
module.exports = {
  iniciarCreacionEvento,
  handleEventoResponse,
  mostrarEventosPorOrganizacion,
  misEventosCommand
}; 