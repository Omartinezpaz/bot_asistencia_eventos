const { Markup } = require('telegraf');
const { Organizacion, Participante, OrganizacionAdmin, Evento, Asistencia, sequelize } = require('./database');
const { Op } = require('sequelize');

// Comando /organizaciones - Muestra las organizaciones disponibles (solo para super admins)
const organizacionesCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario es super admin
    const esSuperAdmin = await verificarSuperAdmin(telegramId);
    
    if (!esSuperAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores del sistema.`
      );
    }
    
    // Obtener todas las organizaciones
    const organizaciones = await Organizacion.findAll({
      order: [['name', 'ASC']]
    });
    
    if (organizaciones.length === 0) {
      return ctx.replyWithMarkdown(
        `ℹ️ *No hay organizaciones registradas*\n\n` +
        `Para crear una nueva organización, usa el comando /crear_organizacion`
      );
    }
    
    // Construir mensaje con la lista de organizaciones
    let mensaje = `📋 *Organizaciones registradas*\n\n`;
    
    // Botones para cada organización
    const botonesOrganizaciones = [];
    
    for (const org of organizaciones) {
      mensaje += `*${org.name}*\n` +
                `📝 ${org.description || 'Sin descripción'}\n` +
                `📧 ${org.contact_email || 'Sin correo'}\n` +
                `📱 ${org.contact_phone || 'Sin teléfono'}\n` +
                `🔄 Estado: ${org.active ? '✅ Activa' : '❌ Inactiva'}\n\n`;
      
      botonesOrganizaciones.push([
        Markup.button.callback(`✏️ Editar ${org.name}`, `edit_org_${org.id}`),
        Markup.button.callback(`${org.active ? '❌ Desactivar' : '✅ Activar'}`, `toggle_org_${org.id}`)
      ]);
    }
    
    // Añadir botón para crear nueva organización
    botonesOrganizaciones.push([
      Markup.button.callback('➕ Crear nueva organización', 'create_org')
    ]);
    
    // Añadir botón para volver al menú principal
    botonesOrganizaciones.push([
      Markup.button.callback('🏠 Menú principal', 'action_main_menu')
    ]);
    
    await ctx.replyWithMarkdown(
      mensaje,
      Markup.inlineKeyboard(botonesOrganizaciones)
    );
  } catch (error) {
    console.error('Error en comando organizaciones:', error);
    await ctx.reply(
      'Ocurrió un error al consultar las organizaciones. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_organizaciones'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /crear_organizacion - Inicia el proceso de creación de una organización
const crearOrganizacionCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario es super admin
    const esSuperAdmin = await verificarSuperAdmin(telegramId);
    
    if (!esSuperAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores del sistema.`
      );
    }
    
    // Inicializar la sesión si no existe
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Iniciar el proceso de creación
    ctx.session.creandoOrganizacion = true;
    ctx.session.orgStep = 'nombre';
    ctx.session.nuevaOrganizacion = {};
    
    await ctx.replyWithMarkdown(
      `🏢 *Creación de nueva organización*\n\n` +
      `Por favor, ingresa el nombre de la organización:`
    );
  } catch (error) {
    console.error('Error en comando crear_organizacion:', error);
    await ctx.reply(
      'Ocurrió un error al iniciar la creación de la organización. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'create_org'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /mi_organizacion - Muestra información de la organización del usuario
const miOrganizacionCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Buscar el participante sin incluir la organización directamente
    const participante = await Participante.findOne({ 
      where: { telegramId }
    });
    
    if (!participante) {
      return ctx.replyWithMarkdown(
        `❌ *No estás registrado*\n\n` +
        `Para consultar información de tu organización, primero debes registrarte.`,
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
    
    // Buscar la organización por separado
    const organizacion = await Organizacion.findByPk(participante.organization_id);
    
    if (!organizacion) {
      return ctx.replyWithMarkdown(
        `❌ *Error*\n\n` +
        `No se encontró la organización asociada a tu cuenta.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Verificar si es administrador de la organización
    const esAdmin = await verificarAdminOrganizacion(telegramId, participante.organization_id);
    
    // Obtener estadísticas de la organización
    const [estadisticas] = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_participantes,
        COUNT(DISTINCT e.id) as total_eventos,
        COUNT(DISTINCT a.id) as total_asistencias
      FROM notif_eventos_bot.organizations o
      LEFT JOIN notif_eventos_bot.participants p ON o.id = p.organization_id
      LEFT JOIN notif_eventos_bot.events e ON o.id = e.organization_id
      LEFT JOIN notif_eventos_bot.attendances a ON e.id = a.eventid AND p.id = a.participantid
      WHERE o.id = :orgId
    `, {
      replacements: { orgId: participante.organization_id }
    });
    
    const stats = estadisticas[0] || { 
      total_participantes: 0, 
      total_eventos: 0, 
      total_asistencias: 0 
    };
    
    // Construir mensaje con la información de la organización
    let mensaje = `🏢 *${organizacion.name}*\n\n` +
                 `📝 ${organizacion.description || 'Sin descripción'}\n` +
                 `📧 ${organizacion.contact_email || 'Sin correo'}\n` +
                 `📱 ${organizacion.contact_phone || 'Sin teléfono'}\n\n` +
                 `📊 *Estadísticas:*\n` +
                 `👥 Participantes: ${stats.total_participantes}\n` +
                 `🗓️ Eventos: ${stats.total_eventos}\n` +
                 `✅ Asistencias: ${stats.total_asistencias}\n`;
    
    // Botones según el rol
    const botones = [];
    
    if (esAdmin) {
      botones.push([
        Markup.button.callback('👥 Ver participantes', `org_participants_${participante.organization_id}`),
        Markup.button.callback('🗓️ Ver eventos', `org_events_${participante.organization_id}`)
      ]);
      
      botones.push([
        Markup.button.callback('📊 Estadísticas detalladas', `org_stats_${participante.organization_id}`),
        Markup.button.callback('✏️ Editar organización', `edit_org_${participante.organization_id}`)
      ]);
    }
    
    // Añadir botón para volver al menú principal
    botones.push([
      Markup.button.callback('🏠 Menú principal', 'action_main_menu')
    ]);
    
    await ctx.replyWithMarkdown(
      mensaje,
      Markup.inlineKeyboard(botones)
    );
  } catch (error) {
    console.error('Error en comando mi_organizacion:', error);
    await ctx.reply(
      'Ocurrió un error al consultar la información de tu organización. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_mi_organizacion'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Función para verificar si un usuario es super admin
const verificarSuperAdmin = async (telegramId) => {
  try {
    const participante = await Participante.findOne({
      where: { telegramId }
    });
    
    if (!participante) return false;
    
    // Si el participante tiene rol 'admin', es super admin
    if (participante.rol === 'admin') {
      return true;
    }
    
    // Verificar en la base de datos directamente con una consulta SQL
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM notif_eventos_bot.organization_admins 
      WHERE participant_id = :participantId AND role = 'super_admin'
    `, {
      replacements: { participantId: participante.id },
      type: sequelize.QueryTypes.SELECT
    });
    
    return results.count > 0 || participante.rol === 'admin';
  } catch (error) {
    console.error('Error al verificar super admin:', error);
    return false;
  }
};

// Función para verificar si un usuario es administrador de una organización
const verificarAdminOrganizacion = async (telegramId, organizationId) => {
  try {
    const participante = await Participante.findOne({
      where: { telegramId }
    });
    
    if (!participante) return false;
    
    // Si el participante tiene rol 'admin', es admin de cualquier organización
    if (participante.rol === 'admin') {
      return true;
    }
    
    // Verificar en la base de datos directamente con una consulta SQL
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM notif_eventos_bot.organization_admins 
      WHERE participant_id = :participantId AND organization_id = :orgId
    `, {
      replacements: { 
        participantId: participante.id,
        orgId: organizationId
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    return results.count > 0;
  } catch (error) {
    console.error('Error al verificar admin de organización:', error);
    return false;
  }
};

// Función para manejar las respuestas durante el proceso de creación de organización
const handleOrganizacionResponse = async (ctx) => {
  try {
    // Inicializar la sesión si no existe
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Si no hay un proceso de creación activo, ignorar el mensaje
    if (!ctx.session.creandoOrganizacion || !ctx.session.orgStep) {
      return;
    }
    
    const texto = ctx.message.text.trim();
    
    // Procesamiento según el paso actual
    switch (ctx.session.orgStep) {
      // Paso 1: Nombre
      case 'nombre':
        if (texto.length < 3 || texto.length > 100) {
          await ctx.reply('El nombre debe tener entre 3 y 100 caracteres. Por favor, intenta nuevamente:');
          return;
        }
        
        ctx.session.nuevaOrganizacion.name = texto;
        ctx.session.orgStep = 'descripcion';
        
        await ctx.replyWithMarkdown(
          `✅ *Nombre registrado:* ${texto}\n\n` +
          `Ahora, ingresa una descripción para la organización (opcional, puedes enviar "-" para omitir):`
        );
        break;
        
      // Paso 2: Descripción
      case 'descripcion':
        if (texto !== '-') {
          ctx.session.nuevaOrganizacion.description = texto;
        }
        
        ctx.session.orgStep = 'email';
        
        await ctx.replyWithMarkdown(
          `✅ *Descripción registrada*\n\n` +
          `Ahora, ingresa un correo electrónico de contacto (opcional, puedes enviar "-" para omitir):`
        );
        break;
        
      // Paso 3: Email
      case 'email':
        if (texto !== '-') {
          // Validación básica de email
          if (texto.includes('@') && texto.includes('.')) {
            ctx.session.nuevaOrganizacion.contact_email = texto;
          } else {
            await ctx.reply('El formato del correo no parece válido. Por favor, intenta nuevamente o envía "-" para omitir:');
            return;
          }
        }
        
        ctx.session.orgStep = 'telefono';
        
        await ctx.replyWithMarkdown(
          `✅ *Correo registrado*\n\n` +
          `Por último, ingresa un número de teléfono de contacto (opcional, puedes enviar "-" para omitir):`
        );
        break;
        
      // Paso 4: Teléfono
      case 'telefono':
        if (texto !== '-') {
          ctx.session.nuevaOrganizacion.contact_phone = texto;
        }
        
        // Guardar la organización en la base de datos
        try {
          const nuevaOrg = await Organizacion.create({
            name: ctx.session.nuevaOrganizacion.name,
            description: ctx.session.nuevaOrganizacion.description,
            contact_email: ctx.session.nuevaOrganizacion.contact_email,
            contact_phone: ctx.session.nuevaOrganizacion.contact_phone,
            active: true
          });
          
          // Asignar al creador como administrador de la organización
          const telegramId = ctx.from.id.toString();
          const participante = await Participante.findOne({ where: { telegramId } });
          
          if (participante) {
            await OrganizacionAdmin.create({
              organization_id: nuevaOrg.id,
              participant_id: participante.id,
              role: 'admin'
            });
          }
          
          await ctx.replyWithMarkdown(
            `🎉 *¡Organización creada exitosamente!*\n\n` +
            `*Nombre:* ${nuevaOrg.name}\n` +
            `*ID:* ${nuevaOrg.id}\n\n` +
            `Puedes gestionar esta organización con el comando /organizaciones`,
            Markup.inlineKeyboard([
              [Markup.button.callback('👥 Gestionar participantes', `org_participants_${nuevaOrg.id}`)],
              [Markup.button.callback('🗓️ Crear evento', `create_event_${nuevaOrg.id}`)],
              [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
            ])
          );
        } catch (error) {
          console.error('Error al crear organización:', error);
          await ctx.reply('Ocurrió un error al crear la organización. Por favor, intenta nuevamente más tarde.');
        }
        
        // Limpiar la sesión
        delete ctx.session.creandoOrganizacion;
        delete ctx.session.orgStep;
        delete ctx.session.nuevaOrganizacion;
        break;
        
      default:
        // Estado desconocido, reiniciar proceso
        delete ctx.session.creandoOrganizacion;
        delete ctx.session.orgStep;
        delete ctx.session.nuevaOrganizacion;
        await ctx.reply('Ocurrió un error en el proceso de creación. Por favor, usa /crear_organizacion para iniciar nuevamente.');
    }
  } catch (error) {
    console.error('Error en procesamiento de respuesta de organización:', error);
    await ctx.reply('Ocurrió un error al procesar tu respuesta. Por favor, intenta nuevamente con /crear_organizacion.');
    
    // Limpiar la sesión en caso de error
    if (ctx.session) {
      delete ctx.session.creandoOrganizacion;
      delete ctx.session.orgStep;
      delete ctx.session.nuevaOrganizacion;
    }
  }
};

// Exportar los comandos
module.exports = {
  organizacionesCommand,
  crearOrganizacionCommand,
  miOrganizacionCommand,
  handleOrganizacionResponse,
  verificarSuperAdmin,
  verificarAdminOrganizacion
}; 