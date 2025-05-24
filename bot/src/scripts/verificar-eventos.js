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

async function verificarYActualizarEventos() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.\n');

    // Consultar todos los eventos
    const [eventos] = await sequelize.query(`
      SELECT id, name, date, active, notification_enabled, notification_hours_before
      FROM notif_eventos_bot.events
      ORDER BY date ASC;
    `);
    
    console.log('Eventos encontrados:', eventos.length);
    
    for (const evento of eventos) {
      console.log(`\nID: ${evento.id}`);
      console.log(`Nombre: ${evento.name}`);
      console.log(`Fecha: ${new Date(evento.date).toLocaleString()}`);
      console.log(`Activo: ${evento.active ? 'Sí' : 'No'}`);
      console.log(`Notificaciones habilitadas: ${evento.notification_enabled !== null ? (evento.notification_enabled ? 'Sí' : 'No') : 'No configurado'}`);
      console.log(`Horas de anticipación: ${evento.notification_hours_before !== null ? evento.notification_hours_before : 'No configurado'}`);
      
      // Si notification_enabled es null, actualizarlo
      if (evento.notification_enabled === null) {
        console.log(`Actualizando configuración de notificaciones para evento ${evento.id}...`);
        
        await sequelize.query(`
          UPDATE notif_eventos_bot.events
          SET notification_enabled = true,
              notification_hours_before = 24
          WHERE id = $1;
        `, {
          bind: [evento.id]
        });
        
        console.log('✅ Evento actualizado correctamente');
      }
    }
    
    console.log('\nVerificación y actualización completadas.');
  } catch (error) {
    console.error('Error al verificar eventos:', error);
  } finally {
    await sequelize.close();
  }
}

verificarYActualizarEventos(); 