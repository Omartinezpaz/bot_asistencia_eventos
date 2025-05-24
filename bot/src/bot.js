const { Telegraf, session } = require('telegraf');
const express = require('express');
const { setupDatabase, Participante } = require('./database');
const { 
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
} = require('./bot-commands');
const {
  organizacionesCommand,
  crearOrganizacionCommand,
  miOrganizacionCommand,
  handleOrganizacionResponse
} = require('./organizacion-commands');
const {
  iniciarCreacionEvento,
  handleEventoResponse,
  mostrarEventosPorOrganizacion,
  misEventosCommand
} = require('./eventos-organizacion');
const {
  generarReporteCommand,
  generarComparativaCommand
} = require('./exportacion-datos');
const personalizacionOrganizacion = require('./personalizacion-organizacion');
const { setupRoutes } = require('./routes');
const NotificationService = require('./services/notification-service');
const NotificationScheduler = require('./notification-scheduler');

// Crear instancia del bot de Telegram
const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware para manejar sesiones
bot.use(session());

// Configurar comandos
bot.command('start', startCommand);
bot.command('login', loginCommand);
bot.command('centro', centroCommand);
bot.command('eventos', eventosCommand);
bot.command('asistencia', asistenciaCommand);
bot.command('help', helpCommand);
bot.command('consultar_cedula', consultarCedulaCommand);
bot.command('ubicacion', ubicacionCommand);
bot.command('geocodificar', geocodificarCommand);
bot.command('corregir_coordenadas', corregirCoordenadasCommand);
bot.command('programar_notificacion', programarNotificacionCommand);
bot.command('ver_notificaciones', verNotificacionesCommand);
bot.command('enviar_notificaciones', enviarNotificacionesCommand);
bot.command('asignar_rol', asignarRolCommand);
bot.command('estadisticas_notificaciones', estadisticasNotificacionesCommand);

// Comandos de organización
bot.command('organizaciones', organizacionesCommand);
bot.command('crear_organizacion', crearOrganizacionCommand);
bot.command('mi_organizacion', miOrganizacionCommand);

// Comandos de eventos por organización
bot.command('mis_eventos', misEventosCommand);

// Comandos de exportación de datos
bot.command('generar_reporte', generarReporteCommand);
bot.command('generar_comparativa', generarComparativaCommand);

// Comando para personalizar organización
bot.command('personalizar_organizacion', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const participante = await Participante.findOne({ 
      where: { telegramId } 
    });
    
    if (!participante || !participante.organization_id) {
      return ctx.replyWithMarkdown(
        `❌ *Error*\n\n` +
        `No perteneces a ninguna organización o no se especificó un ID de organización válido.`
      );
    }
    
    await personalizacionOrganizacion.iniciarPersonalizacion(ctx, participante.organization_id);
  } catch (error) {
    console.error('Error en comando personalizar_organizacion:', error);
    await ctx.reply('Ocurrió un error al iniciar la personalización. Por favor, intenta nuevamente más tarde.');
  }
});

// Manejar mensajes de texto (para login, creación de organizaciones, eventos y personalización)
bot.on('text', async (ctx, next) => {
  // Primero intentar manejar respuestas de personalización
  if (ctx.session && ctx.session.personalizandoOrganizacion) {
    await personalizacionOrganizacion.handlePersonalizacionResponse(ctx);
  }
  // Luego intentar manejar respuestas de creación de eventos
  else if (ctx.session && ctx.session.creandoEvento) {
    await handleEventoResponse(ctx);
  }
  // Luego intentar manejar respuestas de organización
  else if (ctx.session && ctx.session.creandoOrganizacion) {
    await handleOrganizacionResponse(ctx);
  } 
  // Si no es ninguna de las anteriores, pasar al siguiente handler (login)
  else {
    await handleLoginResponse(ctx, next);
  }
});

// Manejar acciones de botones
bot.on('callback_query', async (ctx) => {
  const action = ctx.callbackQuery.data;
  
  // Manejar acciones de personalización
  if (action.startsWith('personalizar_')) {
    await personalizacionOrganizacion.handlePersonalizacionAction(ctx, action);
  } else {
    // Manejar otras acciones con el handler general
    await handleAction(ctx);
  }
});

// Manejar recepción de fotos (para logos de organizaciones)
bot.on('photo', async (ctx) => {
  // Intentar manejar como logo de organización
  await personalizacionOrganizacion.handlePhotoForLogo(ctx);
});

// Manejar ubicaciones compartidas
bot.on('location', handleLocation);

// Crear instancia del servicio de notificaciones
const notificationService = new NotificationService(bot.telegram);

// Crear instancia del programador de notificaciones
const notificationScheduler = new NotificationScheduler(bot);

// Función para iniciar el bot
const startBot = async () => {
  try {
    // Configurar la base de datos
    await setupDatabase();
    
    // Iniciar el bot
    await bot.launch();
    console.log('Bot iniciado correctamente');
    
    // Iniciar el programador de notificaciones (verificar cada 5 minutos)
    notificationScheduler.start('*/5 * * * *');
    
    // Configurar servidor web para webhooks (si es necesario)
    if (process.env.NODE_ENV === 'production' && process.env.PORT) {
      const app = express();
      
      // Configurar rutas
      setupRoutes(app, bot, notificationService, notificationScheduler);
      
      // Iniciar servidor
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`Servidor web iniciado en el puerto ${PORT}`);
      });
    }
  } catch (error) {
    console.error('Error al iniciar el bot:', error);
  }
};

// Manejar señales de terminación
process.once('SIGINT', () => {
  console.log('Deteniendo bot...');
  bot.stop('SIGINT');
  notificationScheduler.stop();
});

process.once('SIGTERM', () => {
  console.log('Deteniendo bot...');
  bot.stop('SIGTERM');
  notificationScheduler.stop();
});

// Exportar para pruebas
module.exports = {
  bot,
  notificationService,
  notificationScheduler,
  startBot
};

// Iniciar el bot si este archivo es el punto de entrada
if (require.main === module) {
  startBot();
} 