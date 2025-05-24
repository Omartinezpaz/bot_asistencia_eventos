const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configurar la conexión a la base de datos
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false, // Desactivar logging para mayor claridad
  dialectOptions: process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') && process.env.NODE_ENV === 'production' 
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } 
    : {},
  schema: 'notif_eventos_bot'
});

async function verNotificaciones() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.\n');

    // Consultar todas las notificaciones programadas
    const [notificaciones] = await sequelize.query(`
      SELECT n.id, n.notification_type, n.message_template, n.scheduled_date, n.sent, n.sent_date,
             e.id as event_id, e.name as event_name, e.date as event_date
      FROM notif_eventos_bot.scheduled_notifications n
      JOIN notif_eventos_bot.events e ON n.event_id = e.id
      ORDER BY n.scheduled_date ASC;
    `);
    
    console.log('Notificaciones programadas:', notificaciones.length);
    
    for (const notif of notificaciones) {
      console.log(`\n=== Notificación ID: ${notif.id} ===`);
      console.log(`Evento: ${notif.event_name} (ID: ${notif.event_id})`);
      console.log(`Fecha del evento: ${new Date(notif.event_date).toLocaleString()}`);
      console.log(`Tipo: ${notif.notification_type}`);
      console.log(`Programada para: ${new Date(notif.scheduled_date).toLocaleString()}`);
      console.log(`Estado: ${notif.sent ? '✅ Enviada' : '⏳ Pendiente'}`);
      if (notif.sent && notif.sent_date) {
        console.log(`Enviada el: ${new Date(notif.sent_date).toLocaleString()}`);
      }
      
      // Mostrar un extracto del mensaje
      const mensajeCorto = notif.message_template.length > 100 
        ? notif.message_template.substring(0, 100) + '...' 
        : notif.message_template;
      console.log(`Mensaje: ${mensajeCorto}`);
    }
    
    console.log('\nResumen de estado:');
    const pendientes = notificaciones.filter(n => !n.sent).length;
    const enviadas = notificaciones.filter(n => n.sent).length;
    console.log(`- Notificaciones pendientes: ${pendientes}`);
    console.log(`- Notificaciones enviadas: ${enviadas}`);
    console.log(`- Total: ${notificaciones.length}`);
    
  } catch (error) {
    console.error('Error al consultar notificaciones:', error);
  } finally {
    await sequelize.close();
  }
}

verNotificaciones(); 