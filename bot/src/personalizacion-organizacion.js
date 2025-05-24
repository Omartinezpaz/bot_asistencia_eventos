const { Organizacion, Participante } = require('./database');
const fs = require('fs');
const path = require('path');

// Directorio para almacenar los logos de las organizaciones
const LOGOS_DIR = path.join(__dirname, '../logos');

// Asegurar que el directorio de logos existe
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

// Clase para manejar la personalización de mensajes y apariencia por organización
class PersonalizacionOrganizacion {
  constructor() {
    // Caché de configuraciones de organizaciones para evitar consultas repetidas a la BD
    this.cacheConfiguraciones = new Map();
    // Tiempo de vida del caché (1 hora)
    this.cacheTTL = 60 * 60 * 1000;
  }

  // Obtener la configuración de personalización de una organización
  async getConfiguracion(organizationId) {
    try {
      // Verificar si tenemos la configuración en caché y si es reciente
      const cachedConfig = this.cacheConfiguraciones.get(organizationId);
      if (cachedConfig && (Date.now() - cachedConfig.timestamp) < this.cacheTTL) {
        return cachedConfig.config;
      }

      // Si no está en caché o expiró, obtener de la base de datos
      const organizacion = await Organizacion.findByPk(organizationId);
      if (!organizacion) {
        throw new Error(`No se encontró la organización con ID ${organizationId}`);
      }

      // Obtener la configuración de personalización (o valores por defecto)
      const config = {
        nombre: organizacion.name,
        colorPrimario: organizacion.primary_color || '#0088cc', // Color por defecto de Telegram
        colorSecundario: organizacion.secondary_color || '#ffffff',
        logoPath: this.getLogoPath(organizationId),
        mensajeBienvenida: organizacion.welcome_message || `¡Bienvenido a ${organizacion.name}!`,
        mensajeDespedida: organizacion.farewell_message || `¡Gracias por usar el bot de ${organizacion.name}!`,
        plantillaNotificacion: organizacion.notification_template || '📢 *{titulo}*\n\n{mensaje}\n\n_{organizacion}_',
        tieneLogoPersonalizado: fs.existsSync(this.getLogoPath(organizationId))
      };

      // Guardar en caché
      this.cacheConfiguraciones.set(organizationId, {
        config,
        timestamp: Date.now()
      });

      return config;
    } catch (error) {
      console.error('Error al obtener configuración de organización:', error);
      // Devolver configuración por defecto
      return {
        nombre: 'Organización',
        colorPrimario: '#0088cc',
        colorSecundario: '#ffffff',
        logoPath: null,
        mensajeBienvenida: '¡Bienvenido!',
        mensajeDespedida: '¡Gracias por usar nuestro bot!',
        plantillaNotificacion: '📢 *{titulo}*\n\n{mensaje}',
        tieneLogoPersonalizado: false
      };
    }
  }

  // Obtener la ruta al logo de una organización
  getLogoPath(organizationId) {
    return path.join(LOGOS_DIR, `logo_${organizationId}.png`);
  }

  // Guardar un nuevo logo para una organización
  async guardarLogo(organizationId, fileBuffer) {
    try {
      const logoPath = this.getLogoPath(organizationId);
      fs.writeFileSync(logoPath, fileBuffer);
      
      // Invalidar caché
      this.cacheConfiguraciones.delete(organizationId);
      
      return true;
    } catch (error) {
      console.error('Error al guardar logo:', error);
      return false;
    }
  }

  // Actualizar la configuración de personalización de una organización
  async actualizarConfiguracion(organizationId, nuevaConfig) {
    try {
      const organizacion = await Organizacion.findByPk(organizationId);
      if (!organizacion) {
        throw new Error(`No se encontró la organización con ID ${organizationId}`);
      }

      // Actualizar campos de personalización
      if (nuevaConfig.colorPrimario) {
        organizacion.primary_color = nuevaConfig.colorPrimario;
      }
      
      if (nuevaConfig.colorSecundario) {
        organizacion.secondary_color = nuevaConfig.colorSecundario;
      }
      
      if (nuevaConfig.mensajeBienvenida) {
        organizacion.welcome_message = nuevaConfig.mensajeBienvenida;
      }
      
      if (nuevaConfig.mensajeDespedida) {
        organizacion.farewell_message = nuevaConfig.mensajeDespedida;
      }
      
      if (nuevaConfig.plantillaNotificacion) {
        organizacion.notification_template = nuevaConfig.plantillaNotificacion;
      }

      // Guardar cambios
      await organizacion.save();
      
      // Invalidar caché
      this.cacheConfiguraciones.delete(organizationId);
      
      return true;
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      return false;
    }
  }

  // Personalizar un mensaje según la organización del usuario
  async personalizarMensaje(mensaje, telegramId) {
    try {
      // Buscar el participante y su organización
      const participante = await Participante.findOne({ 
        where: { telegramId },
        include: [{ model: Organizacion }]
      });

      if (!participante || !participante.organization_id || !participante.Organizacion) {
        return mensaje; // Sin personalización
      }

      // Obtener configuración de la organización
      const config = await this.getConfiguracion(participante.organization_id);
      
      // Reemplazar variables en el mensaje
      let mensajePersonalizado = mensaje
        .replace(/{organizacion}/g, config.nombre)
        .replace(/{usuario}/g, participante.firstName || 'Usuario')
        .replace(/{fecha}/g, new Date().toLocaleDateString())
        .replace(/{hora}/g, new Date().toLocaleTimeString());
      
      return mensajePersonalizado;
    } catch (error) {
      console.error('Error al personalizar mensaje:', error);
      return mensaje; // Devolver mensaje original en caso de error
    }
  }

  // Personalizar una notificación según la organización
  async personalizarNotificacion(titulo, mensaje, organizationId) {
    try {
      // Obtener configuración de la organización
      const config = await this.getConfiguracion(organizationId);
      
      // Usar la plantilla de notificación
      let notificacionPersonalizada = config.plantillaNotificacion
        .replace(/{titulo}/g, titulo)
        .replace(/{mensaje}/g, mensaje)
        .replace(/{organizacion}/g, config.nombre)
        .replace(/{fecha}/g, new Date().toLocaleDateString())
        .replace(/{hora}/g, new Date().toLocaleTimeString());
      
      return notificacionPersonalizada;
    } catch (error) {
      console.error('Error al personalizar notificación:', error);
      // Plantilla por defecto en caso de error
      return `📢 *${titulo}*\n\n${mensaje}`;
    }
  }

  // Iniciar el proceso de personalización de una organización
  async iniciarPersonalizacion(ctx, organizationId) {
    try {
      const telegramId = ctx.from.id.toString();
      
      // Verificar si el usuario es administrador de la organización
      const { verificarAdminOrganizacion } = require('./organizacion-commands');
      const esAdmin = await verificarAdminOrganizacion(telegramId, organizationId);
      
      if (!esAdmin) {
        return ctx.replyWithMarkdown(
          `❌ *Acceso denegado*\n\n` +
          `Solo los administradores pueden personalizar la organización.`
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
      
      // Iniciar el proceso de personalización
      ctx.session.personalizandoOrganizacion = true;
      ctx.session.personalizacionStep = 'menu';
      ctx.session.organizationId = organizationId;
      
      // Mostrar menú de personalización
      await this.mostrarMenuPersonalizacion(ctx);
    } catch (error) {
      console.error('Error al iniciar personalización:', error);
      await ctx.reply(
        'Ocurrió un error al iniciar la personalización. Por favor, intenta nuevamente más tarde.',
        Markup.inlineKeyboard([
          Markup.button.callback('🔙 Volver', 'action_mi_organizacion'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
  }

  // Mostrar el menú de personalización
  async mostrarMenuPersonalizacion(ctx) {
    try {
      const organizationId = ctx.session.organizationId;
      const config = await this.getConfiguracion(organizationId);
      
      await ctx.replyWithMarkdown(
        `🎨 *Personalización de ${config.nombre}*\n\n` +
        `Selecciona qué aspecto deseas personalizar:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🖼️ Cambiar logo', callback_data: 'personalizar_logo' }],
              [{ text: '🎭 Cambiar colores', callback_data: 'personalizar_colores' }],
              [{ text: '💬 Personalizar mensajes', callback_data: 'personalizar_mensajes' }],
              [{ text: '📣 Plantilla de notificaciones', callback_data: 'personalizar_notificaciones' }],
              [{ text: '🔙 Volver', callback_data: 'action_mi_organizacion' }]
            ]
          }
        }
      );
    } catch (error) {
      console.error('Error al mostrar menú de personalización:', error);
      await ctx.reply('Ocurrió un error al mostrar el menú. Por favor, intenta nuevamente.');
    }
  }

  // Manejar las respuestas durante el proceso de personalización
  async handlePersonalizacionResponse(ctx) {
    try {
      // Inicializar la sesión si no existe
      if (!ctx.session) {
        ctx.session = {};
      }
      
      // Si no hay un proceso de personalización activo, ignorar el mensaje
      if (!ctx.session.personalizandoOrganizacion || !ctx.session.personalizacionStep) {
        return;
      }
      
      const texto = ctx.message.text.trim();
      const organizationId = ctx.session.organizationId;
      
      // Procesamiento según el paso actual
      switch (ctx.session.personalizacionStep) {
        // Personalización de colores - Color primario
        case 'color_primario':
          // Validar formato de color hexadecimal
          if (!/^#[0-9A-Fa-f]{6}$/.test(texto)) {
            await ctx.reply('El formato del color debe ser hexadecimal (ejemplo: #0088cc). Por favor, intenta nuevamente:');
            return;
          }
          
          // Guardar color primario en la sesión
          ctx.session.nuevaConfig = ctx.session.nuevaConfig || {};
          ctx.session.nuevaConfig.colorPrimario = texto;
          ctx.session.personalizacionStep = 'color_secundario';
          
          await ctx.replyWithMarkdown(
            `✅ *Color primario registrado:* ${texto}\n\n` +
            `Ahora, ingresa el color secundario en formato hexadecimal (ejemplo: #ffffff):`
          );
          break;
          
        // Personalización de colores - Color secundario
        case 'color_secundario':
          // Validar formato de color hexadecimal
          if (!/^#[0-9A-Fa-f]{6}$/.test(texto)) {
            await ctx.reply('El formato del color debe ser hexadecimal (ejemplo: #ffffff). Por favor, intenta nuevamente:');
            return;
          }
          
          // Guardar color secundario y actualizar configuración
          ctx.session.nuevaConfig.colorSecundario = texto;
          
          // Actualizar en la base de datos
          const resultadoColores = await this.actualizarConfiguracion(organizationId, ctx.session.nuevaConfig);
          
          if (resultadoColores) {
            await ctx.replyWithMarkdown(
              `✅ *Colores actualizados correctamente*\n\n` +
              `Color primario: ${ctx.session.nuevaConfig.colorPrimario}\n` +
              `Color secundario: ${ctx.session.nuevaConfig.colorSecundario}\n\n` +
              `Los cambios se aplicarán en las próximas interacciones.`
            );
          } else {
            await ctx.reply('Ocurrió un error al actualizar los colores. Por favor, intenta nuevamente.');
          }
          
          // Volver al menú de personalización
          ctx.session.personalizacionStep = 'menu';
          await this.mostrarMenuPersonalizacion(ctx);
          break;
          
        // Personalización de mensajes - Mensaje de bienvenida
        case 'mensaje_bienvenida':
          ctx.session.nuevaConfig = ctx.session.nuevaConfig || {};
          ctx.session.nuevaConfig.mensajeBienvenida = texto;
          ctx.session.personalizacionStep = 'mensaje_despedida';
          
          await ctx.replyWithMarkdown(
            `✅ *Mensaje de bienvenida registrado*\n\n` +
            `Ahora, ingresa el mensaje de despedida:`
          );
          break;
          
        // Personalización de mensajes - Mensaje de despedida
        case 'mensaje_despedida':
          ctx.session.nuevaConfig.mensajeDespedida = texto;
          
          // Actualizar en la base de datos
          const resultadoMensajes = await this.actualizarConfiguracion(organizationId, ctx.session.nuevaConfig);
          
          if (resultadoMensajes) {
            await ctx.replyWithMarkdown(
              `✅ *Mensajes actualizados correctamente*\n\n` +
              `Bienvenida: "${ctx.session.nuevaConfig.mensajeBienvenida}"\n` +
              `Despedida: "${ctx.session.nuevaConfig.mensajeDespedida}"\n\n` +
              `Los cambios se aplicarán en las próximas interacciones.`
            );
          } else {
            await ctx.reply('Ocurrió un error al actualizar los mensajes. Por favor, intenta nuevamente.');
          }
          
          // Volver al menú de personalización
          ctx.session.personalizacionStep = 'menu';
          await this.mostrarMenuPersonalizacion(ctx);
          break;
          
        // Personalización de plantilla de notificaciones
        case 'plantilla_notificacion':
          ctx.session.nuevaConfig = ctx.session.nuevaConfig || {};
          ctx.session.nuevaConfig.plantillaNotificacion = texto;
          
          // Actualizar en la base de datos
          const resultadoPlantilla = await this.actualizarConfiguracion(organizationId, ctx.session.nuevaConfig);
          
          if (resultadoPlantilla) {
            // Mostrar ejemplo de notificación con la nueva plantilla
            const ejemploNotificacion = await this.personalizarNotificacion(
              'Título de ejemplo', 
              'Este es un mensaje de ejemplo para mostrar cómo se verán las notificaciones.',
              organizationId
            );
            
            await ctx.replyWithMarkdown(
              `✅ *Plantilla de notificaciones actualizada*\n\n` +
              `Así se verán tus notificaciones:\n\n` +
              `${ejemploNotificacion}`
            );
          } else {
            await ctx.reply('Ocurrió un error al actualizar la plantilla. Por favor, intenta nuevamente.');
          }
          
          // Volver al menú de personalización
          ctx.session.personalizacionStep = 'menu';
          await this.mostrarMenuPersonalizacion(ctx);
          break;
          
        // Esperando logo (este paso se maneja en otro lugar, cuando se recibe una foto)
        case 'esperando_logo':
          await ctx.reply('Por favor, envía una imagen para usar como logo de la organización.');
          break;
          
        default:
          // Estado desconocido, volver al menú
          ctx.session.personalizacionStep = 'menu';
          await this.mostrarMenuPersonalizacion(ctx);
      }
    } catch (error) {
      console.error('Error en procesamiento de personalización:', error);
      await ctx.reply('Ocurrió un error al procesar tu respuesta. Por favor, intenta nuevamente.');
      
      // Limpiar la sesión en caso de error
      if (ctx.session) {
        delete ctx.session.personalizandoOrganizacion;
        delete ctx.session.personalizacionStep;
        delete ctx.session.nuevaConfig;
      }
    }
  }

  // Manejar la recepción de fotos para el logo
  async handlePhotoForLogo(ctx) {
    try {
      // Verificar si estamos esperando un logo
      if (!ctx.session || 
          !ctx.session.personalizandoOrganizacion || 
          ctx.session.personalizacionStep !== 'esperando_logo') {
        return;
      }
      
      const organizationId = ctx.session.organizationId;
      
      // Obtener la foto en su mejor resolución
      const photos = ctx.message.photo;
      const fileId = photos[photos.length - 1].file_id;
      
      // Descargar la foto
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const response = await fetch(fileLink);
      const buffer = await response.buffer();
      
      // Guardar el logo
      const resultado = await this.guardarLogo(organizationId, buffer);
      
      if (resultado) {
        await ctx.replyWithMarkdown(
          `✅ *Logo actualizado correctamente*\n\n` +
          `El nuevo logo se utilizará en las comunicaciones de la organización.`
        );
      } else {
        await ctx.reply('Ocurrió un error al guardar el logo. Por favor, intenta nuevamente.');
      }
      
      // Volver al menú de personalización
      ctx.session.personalizacionStep = 'menu';
      await this.mostrarMenuPersonalizacion(ctx);
    } catch (error) {
      console.error('Error al procesar foto para logo:', error);
      await ctx.reply('Ocurrió un error al procesar la imagen. Por favor, intenta nuevamente.');
    }
  }

  // Manejar acciones de botones relacionadas con la personalización
  async handlePersonalizacionAction(ctx, action) {
    try {
      // Inicializar la sesión si no existe
      if (!ctx.session) {
        ctx.session = {};
      }
      
      // Verificar que tenemos el ID de la organización
      if (!ctx.session.organizationId) {
        // Intentar obtener el ID de la organización del usuario
        const telegramId = ctx.from.id.toString();
        const participante = await Participante.findOne({ 
          where: { telegramId } 
        });
        
        if (!participante || !participante.organization_id) {
          await ctx.answerCbQuery('No se encontró la organización');
          return ctx.replyWithMarkdown(
            `❌ *Error*\n\n` +
            `No se pudo determinar la organización a personalizar.`
          );
        }
        
        ctx.session.organizationId = participante.organization_id;
      }
      
      // Marcar que estamos en proceso de personalización
      ctx.session.personalizandoOrganizacion = true;
      
      // Procesar la acción
      switch (action) {
        case 'personalizar_logo':
          await ctx.answerCbQuery('Cambiando logo...');
          ctx.session.personalizacionStep = 'esperando_logo';
          
          await ctx.replyWithMarkdown(
            `🖼️ *Cambiar logo de la organización*\n\n` +
            `Por favor, envía una imagen para usar como logo de la organización.\n\n` +
            `Recomendaciones:\n` +
            `• Tamaño recomendado: 512x512 píxeles\n` +
            `• Formato: PNG o JPG\n` +
            `• Preferiblemente con fondo transparente`
          );
          break;
          
        case 'personalizar_colores':
          await ctx.answerCbQuery('Personalizando colores...');
          ctx.session.personalizacionStep = 'color_primario';
          ctx.session.nuevaConfig = {};
          
          await ctx.replyWithMarkdown(
            `🎨 *Personalizar colores*\n\n` +
            `Por favor, ingresa el color primario en formato hexadecimal.\n` +
            `Ejemplo: #0088cc`
          );
          break;
          
        case 'personalizar_mensajes':
          await ctx.answerCbQuery('Personalizando mensajes...');
          ctx.session.personalizacionStep = 'mensaje_bienvenida';
          ctx.session.nuevaConfig = {};
          
          await ctx.replyWithMarkdown(
            `💬 *Personalizar mensajes*\n\n` +
            `Por favor, ingresa el mensaje de bienvenida para los usuarios de la organización.\n\n` +
            `Puedes usar las siguientes variables:\n` +
            `• {usuario} - Nombre del usuario\n` +
            `• {organizacion} - Nombre de la organización\n` +
            `• {fecha} - Fecha actual\n` +
            `• {hora} - Hora actual`
          );
          break;
          
        case 'personalizar_notificaciones':
          await ctx.answerCbQuery('Personalizando notificaciones...');
          ctx.session.personalizacionStep = 'plantilla_notificacion';
          ctx.session.nuevaConfig = {};
          
          await ctx.replyWithMarkdown(
            `📣 *Personalizar plantilla de notificaciones*\n\n` +
            `Por favor, ingresa la plantilla para las notificaciones de la organización.\n\n` +
            `Puedes usar las siguientes variables:\n` +
            `• {titulo} - Título de la notificación\n` +
            `• {mensaje} - Contenido de la notificación\n` +
            `• {organizacion} - Nombre de la organización\n` +
            `• {fecha} - Fecha actual\n` +
            `• {hora} - Hora actual\n\n` +
            `Ejemplo:\n` +
            `📢 *{titulo}*\n\n{mensaje}\n\n_{organizacion}_`
          );
          break;
          
        default:
          await ctx.answerCbQuery('Acción no reconocida');
          // Volver al menú de personalización
          await this.mostrarMenuPersonalizacion(ctx);
      }
    } catch (error) {
      console.error('Error al manejar acción de personalización:', error);
      await ctx.answerCbQuery('Ocurrió un error');
      await ctx.reply(
        'Ocurrió un error al procesar la acción. Por favor, intenta nuevamente.',
        Markup.inlineKeyboard([
          Markup.button.callback('🔙 Volver', 'action_mi_organizacion'),
          Markup.button.callback('🏠 Menú principal', 'action_main_menu')
        ])
      );
    }
  }
}

// Crear una instancia global
const personalizacionOrganizacion = new PersonalizacionOrganizacion();

module.exports = personalizacionOrganizacion; 