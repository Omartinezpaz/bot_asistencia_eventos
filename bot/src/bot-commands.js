const { Markup } = require('telegraf');
const { RegistroElectoral, CentroVotacion, Geografia, Participante, Evento, Asistencia } = require('./database');
const { 
  geocodificarDireccion, 
  procesarCentrosSinCoordenadas 
} = require('./geocoder');

// Comando /start - Inicia la interacción con el bot
const startCommand = async (ctx) => {
  try {
    const firstName = ctx.from.first_name || '';
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario está registrado
    const participante = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    // Botones principales con acciones comunes
    const mainButtons = [
      [
        Markup.button.callback('🔐 Registrarse', 'action_register'),
        Markup.button.callback('🏫 Mi Centro', 'action_center')
      ],
      [
        Markup.button.callback('📆 Ver Eventos', 'action_events'),
        Markup.button.callback('✅ Asistencia', 'action_attendance')
      ],
      [
        Markup.button.callback('📍 Compartir Ubicación', 'action_ubicacion'),
        Markup.button.callback('🔍 Consultar Cédula', 'action_consult_cedula')
      ]
    ];
    
    // Si el usuario está registrado, añadir botón de organización
    if (participante) {
      mainButtons.push([
        Markup.button.callback('🏢 Mi Organización', 'action_mi_organizacion')
      ]);
      
      // Si pertenece a una organización, añadir botón de eventos de la organización
      if (participante.organization_id) {
        mainButtons.push([
          Markup.button.callback('📅 Eventos de mi Organización', 'action_mis_eventos')
        ]);
      }
      
      // Si es administrador, añadir botón de gestión de organizaciones
      const esAdmin = await esAdministrador(telegramId);
      if (esAdmin) {
        mainButtons.push([
          Markup.button.callback('👥 Gestionar Organizaciones', 'action_organizaciones')
        ]);
      }
    }
    
    // Añadir botón de ayuda
    mainButtons.push([
      Markup.button.callback('❓ Ayuda', 'action_help')
    ]);
    
    await ctx.replyWithMarkdown(
      `👋 ¡Hola ${firstName}!\n\n` +
      `Bienvenido al *Bot de Notificación de Eventos*\n\n` +
      `Este bot te ayudará a:\n` +
      `• Consultar información sobre eventos\n` +
      `• Registrar tu asistencia\n` +
      `• Consultar tu centro de votación\n` +
      `• Encontrar la ruta hasta tu centro\n` +
      `• Gestionar tu organización\n\n` +
      `Selecciona una opción o escribe un comando:`,
      Markup.inlineKeyboard(mainButtons)
    );
  } catch (error) {
    console.error('Error en comando start:', error);
    await ctx.reply('Ocurrió un error al iniciar el bot. Por favor, intenta nuevamente más tarde.');
  }
};

// Comando /login - Inicia el proceso de login
const loginCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Verificar si ya está registrado
    const participanteExistente = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    if (participanteExistente) {
      return ctx.replyWithMarkdown(
        `✅ *¡Ya estás registrado!*\n\n` +
        `Cédula: ${participanteExistente.nac}-${participanteExistente.cedula}\n` +
        `Nombre: ${participanteExistente.firstName || ''} ${participanteExistente.lastName || ''}\n` +
        `Teléfono: ${participanteExistente.phone || 'No registrado'}\n` +
        `Telegram ID: ${participanteExistente.telegramId}\n\n` +
        `Puedes usar el comando /centro para ver tu centro de votación o /eventos para ver los eventos disponibles.`
      );
    }
    
    // Inicializar la sesión si no existe
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Iniciar el proceso de login
    ctx.session.loginStep = 'cedula';
    
    await ctx.replyWithMarkdown(
      `🔐 *Proceso de registro*\n\n` +
      `Por favor, ingresa tu número de cédula (sin letras ni guiones).`
    );
  } catch (error) {
    console.error('Error en comando login:', error);
    await ctx.reply('Ocurrió un error en el proceso de login. Por favor, intenta nuevamente más tarde.');
  }
};

// Función auxiliar para generar enlaces de mapas
const generarEnlaceMapa = (nombre, direccion, municipio, estado) => {
  // Crea una consulta para Google Maps con la dirección completa
  const consulta = encodeURIComponent(`${nombre}, ${direccion}, ${municipio}, ${estado}, Venezuela`);
  return `https://www.google.com/maps/search/?api=1&query=${consulta}`;
};

// Comando /centro - Muestra información del centro de votación del usuario
const centroCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Buscar el participante
    const participante = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    if (!participante) {
      return ctx.replyWithMarkdown(
        `❌ *No estás registrado*\n\n` +
        `Para consultar tu centro de votación, primero debes registrarte.`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Registrarme ahora', 'action_register'),
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Buscar en el registro electoral
    const registro = await RegistroElectoral.findOne({
      where: { cedula: participante.cedula.toString() },
      include: [{ model: CentroVotacion, required: false }]
    });
    
    if (!registro || !registro.CentroVotacion) {
      return ctx.replyWithMarkdown(
        `❌ *No se encontró información de tu centro de votación*\n\n` +
        `Por favor, verifica que tu cédula esté registrada correctamente.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔄 Intentar con otra cédula', 'action_consult_cedula'),
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Buscar ubicación geográfica
    const geografia = await Geografia.findOne({
      where: {
        cod_estado: registro.cod_estado,
        cod_municipio: registro.cod_municipio,
        cod_parroquia: registro.cod_parroquia
      }
    });
    
    // Construir el mensaje con la información del centro de votación
    const centro = registro.CentroVotacion;
    const nombreEstado = geografia ? geografia.nom_estado : '';
    const nombreMunicipio = geografia ? geografia.nom_municipio : '';
    const nombreParroquia = geografia ? geografia.nom_parroquia : '';
    
    // Generar enlace a Google Maps
    const enlaceMapa = generarEnlaceMapa(
      centro.nombre, 
      centro.direccion, 
      nombreMunicipio, 
      nombreEstado
    );
    
    // Enviar mensaje con la información
    await ctx.replyWithMarkdown(
      `🏫 *Tu centro de votación*\n\n` +
      `*Nombre:* ${centro.nombre}\n` +
      `*Dirección:* ${centro.direccion}\n` +
      `*Estado:* ${nombreEstado}\n` +
      `*Municipio:* ${nombreMunicipio}\n` +
      `*Parroquia:* ${nombreParroquia}\n` +
      `*Código:* ${centro.id}`,
      Markup.inlineKeyboard([
        [
          Markup.button.url('🗺️ Ver en Google Maps', enlaceMapa)
        ],
        [
          Markup.button.callback('✅ Reportar asistencia', 'action_attendance')
        ],
        [
          Markup.button.callback('📆 Ver eventos', 'action_events'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ]
      ])
    );
    
  } catch (error) {
    console.error('Error en comando centro:', error);
    await ctx.reply(
      'Ocurrió un error al consultar tu centro de votación. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_center'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /eventos - Muestra los eventos disponibles
const eventosCommand = async (ctx) => {
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
    
    // Buscar eventos activos
    const eventos = await Evento.findAll({ 
      where: { active: true },
      order: [['date', 'ASC']]
    });
    
    if (eventos.length === 0) {
      return ctx.replyWithMarkdown(
        `ℹ️ *No hay eventos disponibles actualmente*\n\n` +
        `Te notificaremos cuando se programen nuevos eventos.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🏫 Ver mi centro', 'action_center'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
    
    // Construir mensaje con la lista de eventos
    let mensaje = `📆 *Eventos disponibles*\n\n`;
    
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
    
    // Añadir botones de navegación
    botonesEventos.push([
      Markup.button.callback('🏫 Ver mi centro', 'action_center'),
      Markup.button.callback('🏠 Menú principal', 'action_main_menu')
    ]);
    
    await ctx.replyWithMarkdown(
      mensaje,
      Markup.inlineKeyboard(botonesEventos)
    );
  } catch (error) {
    console.error('Error en comando eventos:', error);
    await ctx.reply(
      'Ocurrió un error al consultar los eventos. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_events'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /asistencia - Reporta la asistencia a un evento
const asistenciaCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Buscar el participante
    const participante = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    if (!participante) {
      return ctx.replyWithMarkdown(
        `❌ *No estás registrado*\n\n` +
        `Para registrar tu asistencia, primero debes registrarte.`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Registrarme ahora', 'action_register'),
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Buscar eventos activos
    const eventos = await Evento.findAll({ 
      where: { active: true },
      order: [['date', 'ASC']]
    });
    
    if (eventos.length === 0) {
      return ctx.replyWithMarkdown(
        `ℹ️ *No hay eventos disponibles actualmente*\n\n` +
        `Te notificaremos cuando se programen nuevos eventos.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🏫 Ver mi centro', 'action_center'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
    
    // Si solo hay un evento activo, usarlo directamente
    if (eventos.length === 1) {
      const evento = eventos[0];
      
      // Verificar si ya registró asistencia
      const asistenciaExistente = await Asistencia.findOne({
        where: {
          participantid: participante.id,
          eventid: evento.id
        }
      });
      
      if (asistenciaExistente) {
        return ctx.replyWithMarkdown(
          `ℹ️ *Ya has registrado tu asistencia*\n\n` +
          `Ya registraste tu asistencia al evento *${evento.name}* el ${new Date(asistenciaExistente.registeredAt).toLocaleString()}.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('📆 Ver otros eventos', 'action_events')],
            [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
          ])
        );
      }
      
      try {
        // Registrar asistencia
        await Asistencia.create({
          participantid: participante.id,
          eventid: evento.id,
          status: 'asistió',
          registeredAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        return ctx.replyWithMarkdown(
          `✅ *¡Asistencia registrada!*\n\n` +
          `Has registrado tu asistencia al evento:\n` +
          `*${evento.name}*\n` +
          `Fecha: ${new Date(evento.date).toLocaleDateString()}\n\n` +
          `Gracias por tu participación.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('📆 Ver otros eventos', 'action_events')],
            [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
          ])
        );
      } catch (error) {
        console.error('Error al registrar asistencia:', error);
        return ctx.replyWithMarkdown(
          `❌ *Error al registrar asistencia*\n\n` +
          `Ocurrió un error al registrar tu asistencia. Por favor, intenta nuevamente más tarde.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Intentar nuevamente', 'action_attendance')],
            [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
          ])
        );
      }
    }
    
    // Si hay varios eventos, mostrar botones para seleccionar
    const botones = eventos.map(evento => [
      Markup.button.callback(
        evento.name, 
        `event_${evento.id}`
      )
    ]);
    
    // Añadir botón para volver al menú principal
    botones.push([Markup.button.callback('🏠 Menú principal', 'action_main_menu')]);
    
    await ctx.replyWithMarkdown(
      `📝 *Registrar asistencia*\n\n` +
      `Selecciona el evento al que deseas registrar tu asistencia:`,
      Markup.inlineKeyboard(botones)
    );
  } catch (error) {
    console.error('Error en comando asistencia:', error);
    await ctx.reply(
      'Ocurrió un error al registrar tu asistencia. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_attendance'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Manejar respuestas de texto (principalmente para el proceso de login)
const handleLoginResponse = async (ctx) => {
  try {
    // Inicializar la sesión si no existe
    if (!ctx.session) {
      ctx.session = {};
    }
    
    const telegramId = ctx.from.id.toString();
    const texto = ctx.message.text.trim();
    
    // Verificar si estamos esperando una cédula para consultar
    if (ctx.session.expectingCedula) {
      // Limpiar el estado de espera
      delete ctx.session.expectingCedula;
      
      // Validar que sea un número
      if (!/^\d+$/.test(texto)) {
        return ctx.replyWithMarkdown(
          `❌ *Cédula inválida*\n\n` +
          `Por favor, ingresa solo números.`,
          Markup.inlineKeyboard([
            Markup.button.callback('🔄 Intentar nuevamente', 'action_consult_cedula'),
            Markup.button.callback('🏠 Menú principal', 'action_main_menu')
          ])
        );
      }
      
      // Simular el comando consultarCedula
      ctx.message.text = `/consultar_cedula ${texto}`;
      return consultarCedulaCommand(ctx);
    }
    
    // Si no hay un proceso de login activo, ignorar el mensaje
    if (!ctx.session.loginStep) {
      return;
    }
    
    // Procesamiento según el paso actual
    switch (ctx.session.loginStep) {
      // Paso 1: Cédula
      case 'cedula':
        // Validar que sea un número
        if (!/^\d+$/.test(texto)) {
          await ctx.reply('Por favor, ingresa solo números para la cédula (sin letras ni guiones).');
          return;
        }

        // Validar que la cédula tenga entre 6 y 10 dígitos (rango razonable para cédulas venezolanas)
        if (texto.length < 6 || texto.length > 10) {
          await ctx.reply('El número de cédula debe tener entre 6 y 10 dígitos. Por favor, verifica e intenta nuevamente.');
          return;
        }
        
        // En lugar de buscar en el registro electoral, aceptar cualquier cédula válida
        // Guardar datos en la sesión
        ctx.session.cedula = texto;
        ctx.session.nac = 'V';
        ctx.session.nombre = 'Usuario';
        ctx.session.apellido = 'Registrado';
        ctx.session.loginStep = 'telefono';
        
        await ctx.replyWithMarkdown(
          `✅ *Cédula aceptada*\n\n` +
          `Hola *${ctx.session.nombre} ${ctx.session.apellido}*.\n\n` +
          `Por favor, ingresa tu número de teléfono (formato: 04XX-XXXXXXX o simplemente los números).`
        );
        break;
        
      // Paso 2: Teléfono
      case 'telefono':
        // Mensaje de depuración
        console.log('Teléfono recibido:', texto);
        
        // Limpiar el formato del teléfono (eliminar espacios, guiones, etc.)
        const telefonoLimpio = texto.replace(/[^0-9]/g, '');
        console.log('Teléfono limpio:', telefonoLimpio);
        console.log('Longitud:', telefonoLimpio.length);
        
        // Validación mínima: solo verificamos que tenga al menos 8 dígitos
        if (telefonoLimpio.length < 8) {
          console.log('Error: longitud inválida');
          await ctx.reply('El número debe tener al menos 8 dígitos. Por favor, verifica e intenta nuevamente.');
          return;
        }
        
        // Formatear teléfono - simplemente guardamos el número limpio
        // Si en el futuro queremos formatear, podemos hacerlo
        const telefonoFormateado = telefonoLimpio;
        console.log('Teléfono a guardar:', telefonoFormateado);
        
        // Guardar en la sesión
        ctx.session.telefono = telefonoFormateado;
        
        try {
          console.log('Intentando crear participante...');
          // Registrar al participante asegurando que el telegramId se guarde correctamente
          await Participante.create({
            telegramId: telegramId,
            nac: ctx.session.nac,
            cedula: ctx.session.cedula,
            firstName: ctx.session.nombre,
            lastName: ctx.session.apellido,
            username: ctx.from.username || '',
            phone: telefonoFormateado
          });
          console.log('Participante creado exitosamente');
          
          // Confirmar registro
          await ctx.replyWithMarkdown(
            `🎉 *¡Registro completado!*\n\n` +
            `Has sido registrado correctamente en el sistema.\n\n` +
            `*Datos registrados:*\n` +
            `Cédula: ${ctx.session.nac}-${ctx.session.cedula}\n` +
            `Nombre: ${ctx.session.nombre} ${ctx.session.apellido}\n` +
            `Teléfono: ${telefonoFormateado}\n` +
            `Telegram ID: ${telegramId}\n\n` +
            `Ahora puedes usar los siguientes comandos:\n` +
            `• /centro - Para consultar tu centro de votación\n` +
            `• /eventos - Para ver los eventos disponibles\n` +
            `• /asistencia - Para reportar tu asistencia a eventos`
          );
        } catch (error) {
          console.error('Error al guardar participante:', error);
          await ctx.reply('Ocurrió un error al guardar tus datos. Por favor, intenta nuevamente con /login.');
          // Limpiar la sesión en caso de error
          delete ctx.session.loginStep;
          return;
        }
        
        // Limpiar la sesión
        console.log('Limpiando sesión...');
        delete ctx.session.loginStep;
        delete ctx.session.cedula;
        delete ctx.session.nac;
        delete ctx.session.nombre;
        delete ctx.session.apellido;
        delete ctx.session.telefono;
        console.log('Sesión limpiada');
        break;
        
      default:
        // Estado desconocido, reiniciar proceso
        delete ctx.session.loginStep;
        await ctx.reply('Ocurrió un error en el proceso de registro. Por favor, usa /login para iniciar nuevamente.');
    }
  } catch (error) {
    console.error('Error en procesamiento de respuesta:', error);
    await ctx.reply('Ocurrió un error al procesar tu respuesta. Por favor, intenta nuevamente con /login.');
    
    // Limpiar la sesión en caso de error
    if (ctx.session) {
      delete ctx.session.loginStep;
    }
  }
};

// Maneja las acciones de botones
const handleAction = async (ctx) => {
  try {
    // Inicializar la sesión si no existe
    if (!ctx.session) {
      ctx.session = {};
    }
    
    const action = ctx.callbackQuery.data;
    // Asegurarnos de que el telegramId sea un string
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario está registrado (solo para acciones que requieren registro)
    const requiresRegistration = !['action_register', 'action_consult_cedula', 'action_help', 'info_'].some(prefix => 
      action.startsWith(prefix)
    );
    
    if (requiresRegistration) {
      const participante = await Participante.findOne({ 
        where: { telegramId } 
      });
      
      if (!participante) {
        await ctx.answerCbQuery('Debes registrarte primero');
        return ctx.replyWithMarkdown(
          '❌ *No estás registrado*\n\n' +
          'Para acceder a esta funcionalidad, primero debes registrarte.\n\n' +
          '¿Deseas registrarte ahora?',
          Markup.inlineKeyboard([
            Markup.button.callback('✅ Sí, registrarme', 'action_register'),
            Markup.button.callback('❌ No, ahora no', 'action_cancel')
          ])
        );
      }
    }
    
    // Procesar diferentes tipos de acciones
    if (action === 'action_register') {
      // Inicia el proceso de registro
      await ctx.answerCbQuery('Iniciando registro...');
      return loginCommand(ctx);
    } 
    else if (action === 'action_center') {
      // Muestra el centro de votación
      await ctx.answerCbQuery('Consultando centro...');
      return centroCommand(ctx);
    } 
    else if (action === 'action_events') {
      // Mostrar eventos disponibles
      await ctx.answerCbQuery('Consultando eventos...');
      return eventosCommand(ctx);
    } 
    else if (action === 'action_attendance') {
      // Registrar asistencia
      await ctx.answerCbQuery('Iniciando proceso de asistencia...');
      return asistenciaCommand(ctx);
    } 
    else if (action === 'action_consult_cedula') {
      // Iniciar proceso de consulta de cédula
      await ctx.answerCbQuery('Iniciando consulta de cédula...');
      ctx.session.expectingCedula = true;
      return ctx.replyWithMarkdown(
        '🔍 *Consulta de Centro por Cédula*\n\n' +
        'Por favor, ingresa el número de cédula que deseas consultar:'
      );
    } 
    else if (action === 'action_help') {
      // Mostrar ayuda
      await ctx.answerCbQuery('Mostrando ayuda...');
      return helpCommand(ctx);
    } 
    else if (action === 'action_cancel') {
      // Cancelar operación actual
      await ctx.answerCbQuery('Operación cancelada');
      return ctx.replyWithMarkdown(
        '🔄 *Operación cancelada*\n\n' +
        '¿Qué deseas hacer ahora?',
        Markup.inlineKeyboard([
          Markup.button.callback('🔙 Menú principal', 'action_main_menu')
        ])
      );
    } 
    else if (action === 'action_main_menu') {
      // Volver al menú principal
      await ctx.answerCbQuery('Volviendo al menú principal...');
      return startCommand(ctx);
    } 
    else if (action === 'action_ubicacion') {
      // Iniciar proceso de ubicación
      await ctx.answerCbQuery('Iniciando búsqueda por ubicación...');
      return ubicacionCommand(ctx);
    } 
    // Acciones relacionadas con organizaciones
    else if (action === 'action_organizaciones') {
      // Mostrar organizaciones
      await ctx.answerCbQuery('Consultando organizaciones...');
      const { organizacionesCommand } = require('./organizacion-commands');
      return organizacionesCommand(ctx);
    }
    else if (action === 'action_mi_organizacion') {
      // Mostrar información de la organización del usuario
      await ctx.answerCbQuery('Consultando tu organización...');
      const { miOrganizacionCommand } = require('./organizacion-commands');
      return miOrganizacionCommand(ctx);
    }
    else if (action === 'create_org') {
      // Iniciar proceso de creación de organización
      await ctx.answerCbQuery('Iniciando creación de organización...');
      const { crearOrganizacionCommand } = require('./organizacion-commands');
      return crearOrganizacionCommand(ctx);
    }
    else if (action === 'action_mis_eventos') {
      // Mostrar eventos de la organización del usuario
      await ctx.answerCbQuery('Consultando tus eventos...');
      const { misEventosCommand } = require('./eventos-organizacion');
      return misEventosCommand(ctx);
    }
    else if (action.startsWith('edit_org_')) {
      // Editar una organización
      const orgId = action.split('_')[2];
      await ctx.answerCbQuery(`Editando organización ${orgId}...`);
      
      // Inicializar la sesión para edición
      ctx.session.editandoOrganizacion = true;
      ctx.session.orgStep = 'nombre';
      ctx.session.orgId = orgId;
      
      // Obtener la organización actual
      const { Organizacion } = require('./database');
      const organizacion = await Organizacion.findByPk(orgId);
      
      if (!organizacion) {
        return ctx.editMessageText('❌ Organización no encontrada o ya no está disponible.');
      }
      
      return ctx.editMessageText(
        `✏️ *Editar organización*\n\n` +
        `Estás editando la organización *${organizacion.name}*.\n\n` +
        `Por favor, ingresa el nuevo nombre o envía "-" para mantener el actual (${organizacion.name}):`,
        { parse_mode: 'Markdown' }
      );
    }
    else if (action.startsWith('toggle_org_')) {
      // Activar/desactivar una organización
      const orgId = action.split('_')[2];
      await ctx.answerCbQuery(`Cambiando estado de organización ${orgId}...`);
      
      // Obtener la organización y cambiar su estado
      const { Organizacion } = require('./database');
      const organizacion = await Organizacion.findByPk(orgId);
      
      if (!organizacion) {
        return ctx.editMessageText('❌ Organización no encontrada o ya no está disponible.');
      }
      
      // Cambiar estado
      organizacion.active = !organizacion.active;
      await organizacion.save();
      
      return ctx.editMessageText(
        `✅ *Estado actualizado*\n\n` +
        `La organización *${organizacion.name}* ahora está ${organizacion.active ? 'activada' : 'desactivada'}.`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Volver a organizaciones', 'action_organizaciones')],
            [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
          ])
        }
      );
    }
    else if (action.startsWith('org_participants_')) {
      // Ver participantes de una organización
      const orgId = action.split('_')[2];
      await ctx.answerCbQuery(`Consultando participantes de organización ${orgId}...`);
      
      // Obtener la organización y sus participantes
      const { Organizacion, Participante } = require('./database');
      const organizacion = await Organizacion.findByPk(orgId);
      
      if (!organizacion) {
        return ctx.editMessageText('❌ Organización no encontrada o ya no está disponible.');
      }
      
      // Buscar participantes de la organización
      const participantes = await Participante.findAll({
        where: { organization_id: orgId },
        order: [['firstName', 'ASC']]
      });
      
      if (participantes.length === 0) {
        return ctx.editMessageText(
          `👥 *Participantes de ${organizacion.name}*\n\n` +
          `No hay participantes registrados en esta organización.`,
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Volver', 'action_organizaciones')],
              [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
            ])
          }
        );
      }
      
      // Construir mensaje con la lista de participantes
      let mensaje = `👥 *Participantes de ${organizacion.name}*\n\n`;
      
      participantes.slice(0, 10).forEach((p, index) => {
        mensaje += `${index + 1}. *${p.firstName || ''} ${p.lastName || ''}*\n` +
                  `   📝 CI: ${p.nac}-${p.cedula}\n` +
                  `   📱 Tel: ${p.phone || 'No registrado'}\n\n`;
      });
      
      if (participantes.length > 10) {
        mensaje += `... y ${participantes.length - 10} participantes más.\n\n`;
      }
      
      mensaje += `Total: ${participantes.length} participantes`;
      
      return ctx.editMessageText(
        mensaje,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Volver', 'action_organizaciones')],
            [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
          ])
        }
      );
    }
    else if (action.startsWith('org_events_')) {
      // Ver eventos de una organización
      const orgId = action.split('_')[2];
      await ctx.answerCbQuery(`Consultando eventos de organización ${orgId}...`);
      
      // Usar la función específica para mostrar eventos por organización
      const { mostrarEventosPorOrganizacion } = require('./eventos-organizacion');
      return mostrarEventosPorOrganizacion(ctx, orgId);
    }
    else if (action.startsWith('org_stats_')) {
      // Ver estadísticas de una organización
      const orgId = action.split('_')[2];
      await ctx.answerCbQuery(`Consultando estadísticas de organización ${orgId}...`);
      
      // Generar estadísticas
      const { generarMensajeEstadisticasOrganizacion } = require('./estadisticas-organizacion');
      const mensaje = await generarMensajeEstadisticasOrganizacion(orgId);
      
      return ctx.editMessageText(
        mensaje,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Volver', 'action_mi_organizacion')],
            [Markup.button.callback('🏠 Menú principal', 'action_main_menu')]
          ])
        }
      );
    }
    else if (action.startsWith('create_event_')) {
      // Crear evento para una organización
      const orgId = action.split('_')[2];
      await ctx.answerCbQuery(`Iniciando creación de evento para organización ${orgId}...`);
      
      // Usar la función específica para iniciar la creación de evento
      const { iniciarCreacionEvento } = require('./eventos-organizacion');
      return iniciarCreacionEvento(ctx, orgId);
    }
    else if (action.startsWith('event_')) {
      // Acción para registrar asistencia a un evento
      const eventId = action.split('_')[1];
      
      // Verificar si el evento existe
      const evento = await Evento.findByPk(eventId);
      if (!evento) {
        await ctx.answerCbQuery('Evento no encontrado');
        return ctx.editMessageText('❌ Evento no encontrado o ya no está disponible.');
      }
      
      // Obtener el participante
      const participante = await Participante.findOne({ 
        where: { telegramId } 
      });
      
      // Verificar si ya registró asistencia
      const asistenciaExistente = await Asistencia.findOne({
        where: {
          participantid: participante.id,
          eventid: evento.id
        }
      });
      
      if (asistenciaExistente) {
        await ctx.answerCbQuery('Ya has registrado tu asistencia a este evento');
        return ctx.editMessageText(
          `✅ *Ya has registrado tu asistencia*\n\n` +
          `Ya registraste tu asistencia al evento *${evento.name}* el ${new Date(asistenciaExistente.registeredAt).toLocaleString()}.`,
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('🔙 Volver a eventos', 'action_mis_eventos'),
              Markup.button.callback('🏠 Menú principal', 'action_main_menu')
            ])
          }
        );
      }
      
      try {
        // Registrar asistencia
        await Asistencia.create({
          participantid: participante.id,
          eventid: evento.id,
          status: 'asistió',
          registeredAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await ctx.answerCbQuery('Asistencia registrada correctamente');
        await ctx.editMessageText(
          `✅ *Asistencia registrada*\n\n` +
          `Has registrado tu asistencia al evento *${evento.name}*.\n\n` +
          `¡Gracias por participar!`,
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('🔙 Volver a eventos', 'action_mis_eventos'),
              Markup.button.callback('🏠 Menú principal', 'action_main_menu')
            ])
          }
        );
      } catch (error) {
        console.error('Error al registrar asistencia:', error);
        await ctx.answerCbQuery('Error al registrar asistencia');
        await ctx.editMessageText(
          '❌ Ocurrió un error al registrar tu asistencia. Por favor, intenta nuevamente más tarde.',
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('🔄 Intentar nuevamente', `event_${eventId}`),
              Markup.button.callback('🏠 Menú principal', 'action_main_menu')
            ])
          }
        );
      }
    } else if (action.startsWith('info_')) {
      // Acción para mostrar información (no requiere login)
      await ctx.answerCbQuery('Información');
      await ctx.editMessageText(
        `ℹ️ *Información*\n\n` +
        `Este bot te permite registrarte, consultar tu centro de votación y reportar asistencia a eventos.\n\n` +
        `Comandos disponibles:\n` +
        `• /start - Inicia el bot\n` +
        `• /login - Regístrate con tu cédula\n` +
        `• /centro - Consulta tu centro de votación\n` +
        `• /eventos - Ver eventos disponibles\n` +
        `• /asistencia - Reportar asistencia\n` +
        `• /consultar_cedula - Consultar centro por cédula\n` +
        `• /ubicacion - Encontrar tu centro y calcular distancia\n` +
        `• /organizaciones - Gestionar organizaciones\n` +
        `• /mi_organizacion - Ver tu organización\n` +
        `• /mis_eventos - Ver eventos de tu organización\n` +
        `• /help - Ver esta ayuda`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
          ])
        }
      );
    } else {
      // Acción desconocida
      await ctx.answerCbQuery('Acción no reconocida');
      await ctx.reply(
        '❓ No entiendo esa acción. Por favor, intenta nuevamente.',
        Markup.inlineKeyboard([
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
  } catch (error) {
    console.error('Error en handleAction:', error);
    await ctx.answerCbQuery('Ocurrió un error');
    await ctx.reply(
      '❌ Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /help - Muestra la ayuda del bot
const helpCommand = async (ctx) => {
  try {
    // Verificar si el usuario es administrador
    const telegramId = ctx.from.id.toString();
    const esAdmin = await esAdministrador(telegramId);
    
    let comandos = `📋 *Comandos disponibles*\n\n` +
      `/start - Inicia el bot\n` +
      `/login - Registrarse con cédula\n` +
      `/centro - Ver tu centro de votación\n` +
      `/eventos - Ver eventos disponibles\n` +
      `/asistencia - Registrar asistencia\n` +
      `/consultar_cedula [número] - Consultar centro de votación por cédula\n` +
      `/ubicacion - Encontrar tu centro y calcular distancia\n` +
      `/help - Ver esta ayuda\n\n`;
    
    // Añadir comandos de administrador si corresponde
    if (esAdmin) {
      comandos += `*Comandos de administrador:*\n` +
        `/geocodificar [límite] - Geocodificar centros sin coordenadas (por defecto 5 centros)\n` +
        `/corregir_coordenadas <código> [lat] [lon] - Corregir coordenadas de un centro\n` +
        `/programar_notificacion <id_evento> - Programar notificaciones automáticas para un evento\n` +
        `/ver_notificaciones - Ver todas las notificaciones programadas\n` +
        `/enviar_notificaciones - Enviar manualmente las notificaciones pendientes\n` +
        `/estadisticas_notificaciones [id_evento] - Ver estadísticas de notificaciones\n` +
        `/asignar_rol <cedula> <rol> - Asignar un rol a un usuario (admin/user)\n\n`;
    }
    
    comandos += `Si tienes alguna duda o problema, por favor contacta al administrador.`;
    
    await ctx.replyWithMarkdown(comandos);
  } catch (error) {
    console.error('Error en comando help:', error);
    await ctx.reply('Ocurrió un error al mostrar la ayuda. Por favor, intenta nuevamente más tarde.');
  }
};

// Comando para consultar información de cédula
const consultarCedulaCommand = async (ctx) => {
  try {
    // Obtener argumentos del comando
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    
    if (args.length < 2) {
      return ctx.replyWithMarkdown(
        `⚠️ *Debes ingresar tu cédula*\n\n` +
        `Ejemplo:\n` +
        `/consultar_cedula 12345678`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔄 Intentar nuevamente', 'action_consult_cedula'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
    
    // Extraer la cédula del comando
    const cedula = args[1].replace(/[^0-9]/g, '');
    
    if (!cedula || !/^\d+$/.test(cedula)) {
      return ctx.replyWithMarkdown(
        `❌ *Cédula inválida*\n\n` +
        `Por favor, ingresa solo números.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔄 Intentar nuevamente', 'action_consult_cedula'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
    
    console.log(`Consultando información para la cédula: ${cedula}`);
    
    // Buscar en el registro electoral
    const registro = await RegistroElectoral.findOne({
      where: { cedula: cedula.toString() },
      include: [{ model: CentroVotacion, required: false }]
    });
    
    if (!registro) {
      return ctx.replyWithMarkdown(
        `❌ *No se encontró información*\n\n` +
        `No se encontró información asociada a la cédula ${cedula}.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔄 Intentar con otra cédula', 'action_consult_cedula'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
    
    // Buscar ubicación geográfica
    const geografia = await Geografia.findOne({
      where: {
        cod_estado: registro.cod_estado,
        cod_municipio: registro.cod_municipio,
        cod_parroquia: registro.cod_parroquia
      }
    });
    
    // Construir el mensaje con la información del elector
    const centro = registro.CentroVotacion || {};
    const nombreCompleto = [
      registro.p_nombre || '',
      registro.s_nombre || '',
      registro.p_apellido || '',
      registro.s_apellido || ''
    ].filter(Boolean).join(' ');
    
    const nombreEstado = geografia ? geografia.nom_estado : 'No disponible';
    const nombreMunicipio = geografia ? geografia.nom_municipio : 'No disponible';
    const nombreParroquia = geografia ? geografia.nom_parroquia : 'No disponible';
    
    // Generar enlace a Google Maps
    const enlaceMapa = generarEnlaceMapa(
      centro.nombre || '', 
      centro.direccion || '', 
      nombreMunicipio, 
      nombreEstado
    );
    
    // Enviar mensaje con la información del centro
    await ctx.replyWithMarkdown(
      `¡Hola ${nombreCompleto}! 🇻🇪\n\n` +
      `Hoy te corresponde ejercer tu derecho al voto 🗳️\n\n` +
      `📍 *Tu centro de votación es:*\n\n` +
      `**${centro.nombre || 'No disponible'}**\n` +
      `📌 Dirección: ${centro.direccion || 'No disponible'}\n\n` +
      `📍 Parroquia: ${nombreParroquia}\n` +
      `🗺️ Municipio: ${nombreMunicipio}\n` +
      `🌆 Estado: ${nombreEstado}\n\n` +
      `¡Participa y haz valer tu voz! 🗳️🇻🇪`,
      Markup.inlineKeyboard([
        [
          Markup.button.url('🗺️ Ver en Google Maps', enlaceMapa)
        ],
        [
          Markup.button.callback('✅ Reportar asistencia', 'action_attendance'),
        ],
        [
          Markup.button.callback('🔄 Consultar otra cédula', 'action_consult_cedula'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ]
      ])
    );
    
    // Si tenemos coordenadas conocidas para el centro, enviar ubicación
    if (centro.latitud && centro.longitud) {
      try {
        await ctx.replyWithLocation(centro.latitud, centro.longitud);
      } catch (error) {
        console.error('Error al enviar ubicación:', error);
      }
    }
    
  } catch (error) {
    console.error('Error en comando consultar_cedula:', error);
    await ctx.reply(
      'Ocurrió un error al consultar la información. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_consult_cedula'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Función para calcular la distancia entre dos coordenadas (en kilómetros) - fórmula de Haversine
const calcularDistancia = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distancia en km
  return d;
};

// Función para generar enlace de ruta en Google Maps
const generarEnlaceRuta = (latOrigen, lonOrigen, latDestino, lonDestino, nombreDestino) => {
  return `https://www.google.com/maps/dir/?api=1&origin=${latOrigen},${lonOrigen}&destination=${latDestino},${lonDestino}&destination_place_id=${encodeURIComponent(nombreDestino)}&travelmode=driving`;
};

// Comando para iniciar la búsqueda de centros cercanos
const ubicacionCommand = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Verificar si el usuario está registrado
    const participante = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    if (!participante) {
      return ctx.replyWithMarkdown(
        `❌ *No estás registrado*\n\n` +
        `Para usar esta función, primero debes registrarte.`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Registrarme ahora', 'action_register'),
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Pedir al usuario que comparta su ubicación
    await ctx.replyWithMarkdown(
      `📍 *Compartir ubicación*\n\n` +
      `Para mostrar tu centro de votación y la ruta hasta él, necesito que compartas tu ubicación actual.\n\n` +
      `Por favor, usa el botón de abajo para compartir tu ubicación:`,
      {
        reply_markup: {
          keyboard: [
            [{ text: '📍 Compartir mi ubicación actual', request_location: true }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
    
    // Guardar en la sesión que estamos esperando una ubicación
    if (!ctx.session) ctx.session = {};
    ctx.session.esperandoUbicacion = true;
    
  } catch (error) {
    console.error('Error en comando ubicacion:', error);
    await ctx.reply(
      'Ocurrió un error al iniciar la búsqueda. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_ubicacion'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Manejador para procesar la ubicación compartida
const handleLocation = async (ctx) => {
  try {
    // Verificar si estamos esperando una ubicación
    if (!ctx.session || !ctx.session.esperandoUbicacion) {
      return;
    }
    
    // Eliminar el teclado de ubicación
    await ctx.reply('Procesando tu ubicación...', { 
      reply_markup: { remove_keyboard: true } 
    });
    
    // Limpiar el estado de espera
    delete ctx.session.esperandoUbicacion;
    
    // Obtener la ubicación compartida
    const { latitude, longitude } = ctx.message.location;
    const telegramId = ctx.from.id.toString();
    
    // Buscar el participante
    const participante = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    if (!participante) {
      return ctx.replyWithMarkdown(
        `❌ *No estás registrado*\n\n` +
        `Para usar esta función, primero debes registrarte.`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Registrarme ahora', 'action_register'),
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Buscar en el registro electoral
    const registro = await RegistroElectoral.findOne({
      where: { cedula: participante.cedula.toString() },
      include: [{ model: CentroVotacion, required: false }]
    });
    
    if (!registro || !registro.CentroVotacion) {
      return ctx.replyWithMarkdown(
        `❌ *No se encontró información de tu centro de votación*\n\n` +
        `Por favor, verifica que tu cédula esté registrada correctamente.`,
        Markup.inlineKeyboard([
          Markup.button.callback('🔄 Intentar con otra cédula', 'action_consult_cedula'),
          Markup.button.callback('🏠 Volver al menú', 'action_main_menu')
        ])
      );
    }
    
    // Buscar ubicación geográfica
    const geografia = await Geografia.findOne({
      where: {
        cod_estado: registro.cod_estado,
        cod_municipio: registro.cod_municipio,
        cod_parroquia: registro.cod_parroquia
      }
    });
    
    // Obtener información del centro de votación
    const centro = registro.CentroVotacion;
    const nombreEstado = geografia ? geografia.nom_estado : 'No disponible';
    const nombreMunicipio = geografia ? geografia.nom_municipio : 'No disponible';
    const nombreParroquia = geografia ? geografia.nom_parroquia : 'No disponible';
    
    // Calcular la distancia al centro (si el centro tiene coordenadas)
    let distancia = null;
    let enlaceRuta = null;
    
    if (centro.latitud && centro.longitud) {
      distancia = calcularDistancia(latitude, longitude, centro.latitud, centro.longitud);
      enlaceRuta = generarEnlaceRuta(
        latitude, 
        longitude, 
        centro.latitud, 
        centro.longitud, 
        centro.nom_centro
      );
      
      // Enviar la ubicación del centro como mensaje separado
      await ctx.replyWithLocation(centro.latitud, centro.longitud);
    }
    
    // Generar mensaje con la información
    let mensaje = `🏫 *Tu centro de votación*\n\n` +
      `*Nombre:* ${centro.nom_centro}\n` +
      `*Dirección:* ${centro.direccion}\n` +
      `*Estado:* ${nombreEstado}\n` +
      `*Municipio:* ${nombreMunicipio}\n` +
      `*Parroquia:* ${nombreParroquia}\n`;
      
    // Añadir información de distancia si está disponible
    if (distancia !== null) {
      mensaje += `*Distancia aproximada:* ${distancia.toFixed(2)} km\n`;
    }
    
    // Crear botones
    const botones = [];
    
    // Añadir botón de ruta si tenemos coordenadas
    if (enlaceRuta) {
      botones.push([
        Markup.button.url('🗺️ Ver ruta en Google Maps', enlaceRuta)
      ]);
    }
    
    // Añadir botones estándar
    botones.push([
      Markup.button.callback('✅ Reportar asistencia', 'action_attendance')
    ]);
    botones.push([
      Markup.button.callback('📆 Ver eventos', 'action_events'),
      Markup.button.callback('🏠 Menú principal', 'action_main_menu')
    ]);
    
    // Enviar mensaje con la información y botones
    await ctx.replyWithMarkdown(mensaje, Markup.inlineKeyboard(botones));
    
  } catch (error) {
    console.error('Error al procesar ubicación:', error);
    await ctx.reply(
      'Ocurrió un error al procesar tu ubicación. Por favor, intenta nuevamente más tarde.',
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Intentar nuevamente', 'action_ubicacion'),
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Función auxiliar para verificar si un usuario es administrador
const esAdministrador = async (telegramId) => {
  try {
    const { Participante } = require('./database');
    const participante = await Participante.findOne({
      where: { telegramId: telegramId.toString() }
    });
    
    return participante && participante.rol === 'admin';
  } catch (error) {
    console.error('Error al verificar rol de administrador:', error);
    return false;
  }
};

// Comando /programar_notificacion - Programa una notificación para un evento (solo para administradores)
const programarNotificacionCommand = async (ctx) => {
  try {
    // Verificar si el usuario es administrador
    const telegramId = ctx.from.id.toString();
    const esAdmin = await esAdministrador(telegramId);
    
    if (!esAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores.`
      );
    }
    
    // Obtener argumentos del comando: /programar_notificacion <id_evento>
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    
    if (args.length < 2) {
      return ctx.replyWithMarkdown(
        `⚠️ *Uso incorrecto*\n\n` +
        `*Uso:*\n` +
        `/programar_notificacion <id_evento>\n\n` +
        `*Ejemplo:*\n` +
        `• /programar_notificacion 1 - Programa notificaciones automáticas para el evento con ID 1`
      );
    }
    
    const eventId = parseInt(args[1]);
    
    if (isNaN(eventId)) {
      return ctx.replyWithMarkdown(
        `❌ *ID de evento inválido*\n\n` +
        `Por favor, proporciona un ID de evento válido.`
      );
    }
    
    // Importar el servicio de notificaciones
    const NotificationService = require('./services/notification-service');
    const notificationService = new NotificationService(ctx.telegram);
    
    // Programar notificaciones automáticas
    await ctx.replyWithMarkdown(
      `🔄 *Programando notificaciones*\n\n` +
      `Programando notificaciones automáticas para el evento ${eventId}...`
    );
    
    const notificaciones = await notificationService.scheduleAutomaticNotifications(eventId);
    
    if (notificaciones.length === 0) {
      return ctx.replyWithMarkdown(
        `⚠️ *No se programaron notificaciones*\n\n` +
        `No se pudieron programar notificaciones para el evento ${eventId}. Posibles causas:\n` +
        `• El evento no existe\n` +
        `• Las notificaciones están desactivadas para este evento`
      );
    }
    
    // Mostrar información de las notificaciones programadas
    let mensaje = `✅ *Notificaciones programadas*\n\n` +
                 `Se han programado ${notificaciones.length} notificaciones para el evento ${eventId}:\n\n`;
    
    for (const notif of notificaciones) {
      mensaje += `• Tipo: ${notif.notification_type}\n` +
                `  Fecha: ${new Date(notif.scheduled_date).toLocaleString()}\n\n`;
    }
    
    await ctx.replyWithMarkdown(mensaje);
  } catch (error) {
    console.error('Error en comando programar_notificacion:', error);
    await ctx.reply(
      'Ocurrió un error al programar las notificaciones. Por favor, revisa los logs para más información.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /ver_notificaciones - Muestra las notificaciones programadas (solo para administradores)
const verNotificacionesCommand = async (ctx) => {
  try {
    // Verificar si el usuario es administrador
    const telegramId = ctx.from.id.toString();
    const esAdmin = await esAdministrador(telegramId);
    
    if (!esAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores.`
      );
    }
    
    // Importar el modelo de notificaciones
    const { NotificacionProgramada, Evento } = require('./database');
    
    // Buscar todas las notificaciones programadas
    const notificaciones = await NotificacionProgramada.findAll({
      include: [{ model: Evento, required: true }],
      order: [['scheduled_date', 'ASC']]
    });
    
    if (notificaciones.length === 0) {
      return ctx.replyWithMarkdown(
        `ℹ️ *No hay notificaciones programadas*\n\n` +
        `No se encontraron notificaciones programadas en el sistema.`
      );
    }
    
    // Agrupar notificaciones por evento
    const notificacionesPorEvento = {};
    
    for (const notif of notificaciones) {
      const eventId = notif.event_id;
      if (!notificacionesPorEvento[eventId]) {
        notificacionesPorEvento[eventId] = {
          nombre: notif.Evento.name,
          notificaciones: []
        };
      }
      
      notificacionesPorEvento[eventId].notificaciones.push({
        tipo: notif.notification_type,
        fecha: new Date(notif.scheduled_date).toLocaleString(),
        enviada: notif.sent ? '✅' : '⏳'
      });
    }
    
    // Construir mensaje
    let mensaje = `📋 *Notificaciones programadas*\n\n`;
    
    for (const eventId in notificacionesPorEvento) {
      const info = notificacionesPorEvento[eventId];
      mensaje += `*Evento:* ${info.nombre} (ID: ${eventId})\n`;
      
      for (const notif of info.notificaciones) {
        mensaje += `• ${notif.enviada} Tipo: ${notif.tipo}\n` +
                  `  Fecha: ${notif.fecha}\n`;
      }
      
      mensaje += `\n`;
    }
    
    await ctx.replyWithMarkdown(mensaje);
  } catch (error) {
    console.error('Error en comando ver_notificaciones:', error);
    await ctx.reply(
      'Ocurrió un error al consultar las notificaciones. Por favor, revisa los logs para más información.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /enviar_notificaciones - Envía las notificaciones pendientes (solo para administradores)
const enviarNotificacionesCommand = async (ctx) => {
  try {
    // Verificar si el usuario es administrador
    const telegramId = ctx.from.id.toString();
    const esAdmin = await esAdministrador(telegramId);
    
    if (!esAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores.`
      );
    }
    
    // Importar el servicio de notificaciones
    const NotificationService = require('./services/notification-service');
    const notificationService = new NotificationService(ctx.telegram);
    
    await ctx.replyWithMarkdown(
      `🔄 *Enviando notificaciones pendientes*\n\n` +
      `Procesando notificaciones pendientes...`
    );
    
    const sentCount = await notificationService.sendPendingNotifications();
    
    await ctx.replyWithMarkdown(
      `✅ *Notificaciones enviadas*\n\n` +
      `Se han enviado ${sentCount} notificaciones pendientes.`
    );
  } catch (error) {
    console.error('Error en comando enviar_notificaciones:', error);
    await ctx.reply(
      'Ocurrió un error al enviar las notificaciones. Por favor, revisa los logs para más información.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /geocodificar - Inicia el proceso de geocodificación (solo para administradores)
const geocodificarCommand = async (ctx) => {
  try {
    // Verificar si el usuario es administrador
    const telegramId = ctx.from.id.toString();
    const esAdmin = await esAdministrador(telegramId);
    
    if (!esAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores.`
      );
    }
    
    // Obtener el límite (opcional)
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    const limite = args.length > 1 && !isNaN(args[1]) ? parseInt(args[1]) : 5;
    
    // Enviar mensaje inicial
    await ctx.replyWithMarkdown(
      `🔄 *Iniciando proceso de geocodificación*\n\n` +
      `Se procesarán hasta ${limite} centros de votación sin coordenadas.\n` +
      `Este proceso puede tardar varios minutos.`
    );
    
    // Ejecutar la geocodificación
    const estadisticas = await procesarCentrosSinCoordenadas(limite);
    
    // Enviar resultados
    await ctx.replyWithMarkdown(
      `✅ *Proceso de geocodificación completado*\n\n` +
      `📊 *Estadísticas:*\n` +
      `• Total de centros procesados: ${estadisticas.total}\n` +
      `• Centros actualizados: ${estadisticas.actualizados}\n` +
      `• Centros sin actualizar: ${estadisticas.total - estadisticas.actualizados}`
    );
  } catch (error) {
    console.error('Error en comando geocodificar:', error);
    await ctx.reply(
      'Ocurrió un error durante el proceso de geocodificación. Por favor, revisa los logs para más información.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /corregir_coordenadas - Permite corregir coordenadas erróneas (solo para administradores)
const corregirCoordenadasCommand = async (ctx) => {
  try {
    // Verificar si el usuario es administrador
    const telegramId = ctx.from.id.toString();
    const esAdmin = await esAdministrador(telegramId);
    
    if (!esAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores.`
      );
    }
    
    // Obtener argumentos del comando: /corregir_coordenadas <codigo_centro> [latitud] [longitud]
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    
    if (args.length < 2) {
      return ctx.replyWithMarkdown(
        `⚠️ *Uso incorrecto*\n\n` +
        `*Uso:*\n` +
        `/corregir_coordenadas <codigo_centro> [latitud] [longitud]\n\n` +
        `*Ejemplos:*\n` +
        `• /corregir_coordenadas 12345 - Intenta geocodificar nuevamente con todos los proveedores\n` +
        `• /corregir_coordenadas 12345 8.123456 -66.789012 - Establece coordenadas manualmente`
      );
    }
    
    const codigoCentro = args[1];
    const latitud = args.length > 2 ? parseFloat(args[2]) : undefined;
    const longitud = args.length > 3 ? parseFloat(args[3]) : undefined;
    
    // Validar el código del centro
    if (!/^\d+$/.test(codigoCentro)) {
      return ctx.replyWithMarkdown(
        `❌ *Código de centro inválido*\n\n` +
        `El código debe contener solo números.`
      );
    }
    
    // Validar coordenadas si se proporcionan
    if ((latitud !== undefined && isNaN(latitud)) || (longitud !== undefined && isNaN(longitud))) {
      return ctx.replyWithMarkdown(
        `❌ *Coordenadas inválidas*\n\n` +
        `Las coordenadas deben ser números válidos.\n` +
        `Ejemplo: /corregir_coordenadas 12345 8.123456 -66.789012`
      );
    }
    
    // Caso 1: Si se proporcionan coordenadas, actualizar manualmente
    if (latitud !== undefined && longitud !== undefined) {
      await ctx.replyWithMarkdown(
        `🔄 *Actualizando coordenadas manualmente*\n\n` +
        `Centro: ${codigoCentro}\n` +
        `Latitud: ${latitud}\n` +
        `Longitud: ${longitud}\n\n` +
        `Por favor, espera...`
      );
      
      const { corregirCoordenadasCentro } = require('./geocoder');
      const resultado = await corregirCoordenadasCentro(parseInt(codigoCentro), latitud, longitud);
      
      if (resultado) {
        return ctx.replyWithMarkdown(
          `✅ *Coordenadas actualizadas correctamente*\n\n` +
          `Las coordenadas del centro ${codigoCentro} han sido actualizadas manualmente.`
        );
      } else {
        return ctx.replyWithMarkdown(
          `❌ *Error al actualizar coordenadas*\n\n` +
          `No se pudieron actualizar las coordenadas. Posibles causas:\n` +
          `• El centro no existe\n` +
          `• Las coordenadas están fuera de rango\n` +
          `• Error en la base de datos\n\n` +
          `Verifica los logs para más detalles.`
        );
      }
    }
    
    // Caso 2: Si no se proporcionan coordenadas, intentar geocodificar nuevamente
    await ctx.replyWithMarkdown(
      `🔄 *Recalculando coordenadas*\n\n` +
      `Iniciando geocodificación para el centro ${codigoCentro}...\n` +
      `Se intentará con múltiples proveedores de geocodificación.\n` +
      `Este proceso puede tardar varios segundos.`
    );
    
    const { corregirCoordenadasCentro } = require('./geocoder');
    const resultado = await corregirCoordenadasCentro(parseInt(codigoCentro));
    
    if (resultado) {
      // Buscar el centro para obtener las coordenadas actualizadas
      const { CentroVotacion } = require('./database');
      const centro = await CentroVotacion.findByPk(parseInt(codigoCentro));
      
      // Enviar la ubicación actualizada
      if (centro && centro.latitud && centro.longitud) {
        await ctx.replyWithLocation(centro.latitud, centro.longitud);
      }
      
      return ctx.replyWithMarkdown(
        `✅ *Coordenadas actualizadas correctamente*\n\n` +
        `Las coordenadas del centro ${codigoCentro} han sido actualizadas mediante geocodificación.\n` +
        `Proveedor utilizado: ${centro?.proveedor_geo || 'desconocido'}\n\n` +
        `Latitud: ${centro?.latitud}\n` +
        `Longitud: ${centro?.longitud}`
      );
    } else {
      return ctx.replyWithMarkdown(
        `❌ *Error al actualizar coordenadas*\n\n` +
        `No se pudieron obtener coordenadas para este centro. Posibles causas:\n` +
        `• El centro no existe\n` +
        `• La dirección no es precisa\n` +
        `• Ningún proveedor de geocodificación pudo encontrar las coordenadas\n\n` +
        `Puedes intentar actualizar las coordenadas manualmente:\n` +
        `/corregir_coordenadas ${codigoCentro} [latitud] [longitud]`
      );
    }
  } catch (error) {
    console.error('Error en comando corregir_coordenadas:', error);
    await ctx.reply(
      'Ocurrió un error al corregir las coordenadas. Por favor, revisa los logs para más información.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /asignar_rol - Permite asignar un rol a un usuario (solo para administradores)
const asignarRolCommand = async (ctx) => {
  try {
    // Verificar si el usuario es administrador
    const telegramId = ctx.from.id.toString();
    const esAdmin = await esAdministrador(telegramId);
    
    if (!esAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores.`
      );
    }
    
    // Obtener argumentos del comando: /asignar_rol <cedula> <rol>
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    
    if (args.length < 3) {
      return ctx.replyWithMarkdown(
        `⚠️ *Uso incorrecto*\n\n` +
        `*Uso:*\n` +
        `/asignar_rol <cedula> <rol>\n\n` +
        `*Roles disponibles:*\n` +
        `• admin - Administrador con acceso a todas las funciones\n` +
        `• user - Usuario normal\n\n` +
        `*Ejemplo:*\n` +
        `• /asignar_rol 12345678 admin - Asigna rol de administrador al usuario con cédula 12345678`
      );
    }
    
    const cedula = args[1];
    const rol = args[2].toLowerCase();
    
    // Validar el rol
    if (rol !== 'admin' && rol !== 'user') {
      return ctx.replyWithMarkdown(
        `❌ *Rol inválido*\n\n` +
        `Los roles disponibles son:\n` +
        `• admin - Administrador con acceso a todas las funciones\n` +
        `• user - Usuario normal`
      );
    }
    
    // Buscar al participante por cédula
    const { Participante } = require('./database');
    const participante = await Participante.findOne({
      where: { cedula: cedula.toString() }
    });
    
    if (!participante) {
      return ctx.replyWithMarkdown(
        `❌ *Usuario no encontrado*\n\n` +
        `No se encontró ningún usuario registrado con la cédula ${cedula}.`
      );
    }
    
    // Actualizar el rol
    const rolAnterior = participante.rol || 'user';
    participante.rol = rol;
    await participante.save();
    
    await ctx.replyWithMarkdown(
      `✅ *Rol actualizado correctamente*\n\n` +
      `Usuario: ${participante.firstName} ${participante.lastName}\n` +
      `Cédula: ${participante.nac}-${participante.cedula}\n` +
      `Rol anterior: ${rolAnterior}\n` +
      `Nuevo rol: ${rol}`
    );
  } catch (error) {
    console.error('Error en comando asignar_rol:', error);
    await ctx.reply(
      'Ocurrió un error al asignar el rol. Por favor, revisa los logs para más información.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

// Comando /estadisticas_notificaciones - Muestra estadísticas de las notificaciones (solo para administradores)
const estadisticasNotificacionesCommand = async (ctx) => {
  try {
    // Verificar si el usuario es administrador
    const telegramId = ctx.from.id.toString();
    const esAdmin = await esAdministrador(telegramId);
    
    if (!esAdmin) {
      return ctx.replyWithMarkdown(
        `❌ *Acceso denegado*\n\n` +
        `Este comando solo está disponible para administradores.`
      );
    }
    
    // Obtener argumentos del comando: /estadisticas_notificaciones [id_evento]
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    let eventId = null;
    
    if (args.length > 1) {
      eventId = parseInt(args[1]);
      if (isNaN(eventId)) {
        return ctx.replyWithMarkdown(
          `❌ *ID de evento inválido*\n\n` +
          `Por favor, proporciona un ID de evento válido o usa el comando sin argumentos para ver todas las estadísticas.`
        );
      }
    }
    
    // Importar el servicio de notificaciones
    const NotificationService = require('./services/notification-service');
    const notificationService = new NotificationService(ctx.telegram);
    
    // Si se especificó un ID de evento, mostrar estadísticas solo para ese evento
    if (eventId) {
      // Verificar que el evento existe
      const { Evento } = require('./database');
      const evento = await Evento.findByPk(eventId);
      
      if (!evento) {
        return ctx.replyWithMarkdown(
          `❌ *Evento no encontrado*\n\n` +
          `No se encontró ningún evento con el ID ${eventId}.`
        );
      }
      
      await ctx.replyWithMarkdown(
        `🔄 *Obteniendo estadísticas*\n\n` +
        `Consultando estadísticas de notificaciones para el evento "${evento.name}"...`
      );
      
      const stats = await notificationService.getEventNotificationStats(eventId);
      
      if (!stats || stats.length === 0) {
        return ctx.replyWithMarkdown(
          `ℹ️ *No hay estadísticas disponibles*\n\n` +
          `No se encontraron estadísticas para el evento "${evento.name}" (ID: ${eventId}).`
        );
      }
      
      // Construir mensaje con las estadísticas
      let mensaje = `📊 *Estadísticas de notificaciones*\n\n` +
                   `*Evento:* ${evento.name} (ID: ${eventId})\n\n`;
      
      for (const stat of stats) {
        mensaje += `*Notificación:* ${stat.notification_id} (${stat.notification_type})\n` +
                  `• Total participantes: ${stat.total_participants}\n` +
                  `• Enviadas: ${stat.sent_count} (${stat.sent_percentage}%)\n` +
                  `• Entregadas: ${stat.delivered_count} (${stat.delivered_percentage}%)\n` +
                  `• Leídas: ${stat.read_count} (${stat.read_percentage}%)\n` +
                  `• Respondidas: ${stat.responded_count} (${stat.responded_percentage}%)\n\n`;
      }
      
      await ctx.replyWithMarkdown(mensaje);
    } else {
      // Mostrar estadísticas generales de todos los eventos
      const { sequelize } = require('./database');
      
      await ctx.replyWithMarkdown(
        `🔄 *Obteniendo estadísticas generales*\n\n` +
        `Consultando estadísticas de notificaciones para todos los eventos...`
      );
      
      // Consulta para obtener estadísticas resumidas por evento
      const [eventStats] = await sequelize.query(`
        SELECT
          e.id AS event_id,
          e.name AS event_name,
          COUNT(DISTINCT n.id) AS total_notifications,
          COUNT(ns.id) AS total_participants,
          SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END) AS sent_count,
          SUM(CASE WHEN ns.delivered THEN 1 ELSE 0 END) AS delivered_count,
          SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) AS read_count,
          SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) AS responded_count,
          CASE 
            WHEN COUNT(ns.id) > 0 THEN 
              ROUND((SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
            ELSE 0
          END AS sent_percentage,
          CASE 
            WHEN COUNT(ns.id) > 0 THEN 
              ROUND((SUM(CASE WHEN ns.read THEN 1 ELSE 0 END)::numeric / COUNT(ns.id)::numeric) * 100, 2)
            ELSE 0
          END AS read_percentage
        FROM
          notif_eventos_bot.events e
        LEFT JOIN
          notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
        LEFT JOIN
          notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
        GROUP BY
          e.id, e.name
        ORDER BY
          e.id
      `);
      
      if (!eventStats || eventStats.length === 0) {
        return ctx.replyWithMarkdown(
          `ℹ️ *No hay estadísticas disponibles*\n\n` +
          `No se encontraron estadísticas de notificaciones.`
        );
      }
      
      // Construir mensaje con las estadísticas
      let mensaje = `📊 *Estadísticas generales de notificaciones*\n\n`;
      
      for (const stat of eventStats) {
        // Solo incluir eventos que tengan notificaciones
        if (stat.total_notifications > 0) {
          mensaje += `*Evento:* ${stat.event_name} (ID: ${stat.event_id})\n` +
                    `• Notificaciones: ${stat.total_notifications}\n` +
                    `• Participantes: ${stat.total_participants}\n` +
                    `• Tasa de envío: ${stat.sent_percentage}%\n` +
                    `• Tasa de lectura: ${stat.read_percentage}%\n\n`;
        }
      }
      
      mensaje += `Para ver estadísticas detalladas de un evento específico, usa:\n` +
                `/estadisticas_notificaciones <id_evento>`;
      
      await ctx.replyWithMarkdown(mensaje);
    }
  } catch (error) {
    console.error('Error en comando estadisticas_notificaciones:', error);
    await ctx.reply(
      'Ocurrió un error al consultar las estadísticas. Por favor, revisa los logs para más información.',
      Markup.inlineKeyboard([
        Markup.button.callback('🏠 Menú principal', 'action_main_menu')
      ])
    );
  }
};

module.exports = {
  startCommand,
  loginCommand,
  centroCommand,
  eventosCommand,
  asistenciaCommand,
  handleLoginResponse,
  handleAction,
  helpCommand,
  consultarCedulaCommand,
  ubicacionCommand,
  handleLocation,
  geocodificarCommand,
  corregirCoordenadasCommand,
  programarNotificacionCommand,
  verNotificacionesCommand,
  enviarNotificacionesCommand,
  asignarRolCommand,
  estadisticasNotificacionesCommand
}; 