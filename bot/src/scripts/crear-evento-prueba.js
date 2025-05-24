const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configurar la conexión a la base de datos
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: console.log,
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

// Crear un evento de prueba para hoy
async function crearEventoPrueba() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    // Crear fecha para hoy (con hora actual + 2 horas)
    const fechaEvento = new Date();
    fechaEvento.setHours(fechaEvento.getHours() + 2); // El evento será 2 horas después de la hora actual

    console.log('Creando evento de prueba para:', fechaEvento.toLocaleString());
    
    // Insertar el evento
    const [result] = await sequelize.query(`
      INSERT INTO notif_eventos_bot.events
      (name, description, date, location, active, createdat, updatedat, notification_enabled, notification_hours_before)
      VALUES
      ('Prueba de Asistencia Electoral', 
       'Este es un evento de prueba para verificar el sistema de reporte de asistencia. Por favor, utiliza el comando /asistencia para reportar tu participación.',
       $1,
       'Centros de votación designados',
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, 1)
      RETURNING id;
    `, {
      bind: [fechaEvento]
    });
    
    const eventoId = result[0].id;
    console.log('✅ Evento de prueba creado exitosamente con ID:', eventoId);
    console.log('\nPara programar notificaciones para este evento, usa el comando:');
    console.log(`/programar_notificacion ${eventoId}`);
    
    // Crear otro evento para mañana (elecciones)
    const fechaManana = new Date();
    fechaManana.setDate(fechaManana.getDate() + 1);
    fechaManana.setHours(7, 0, 0, 0); // 7:00 AM
    
    console.log('\nCreando evento de elecciones para mañana:', fechaManana.toLocaleString());
    
    const [resultElecciones] = await sequelize.query(`
      INSERT INTO notif_eventos_bot.events
      (name, description, date, location, active, createdat, updatedat, notification_enabled, notification_hours_before)
      VALUES
      ('Elecciones Presidenciales 2024', 
       'Jornada electoral para elegir al Presidente de la República. Todos los ciudadanos inscritos en el registro electoral están convocados a participar en este importante proceso democrático.',
       $1,
       'Centros de votación en todo el país',
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, 12)
      RETURNING id;
    `, {
      bind: [fechaManana]
    });
    
    const eleccionesId = resultElecciones[0].id;
    console.log('✅ Evento de elecciones creado exitosamente con ID:', eleccionesId);
    console.log('\nPara programar notificaciones para este evento, usa el comando:');
    console.log(`/programar_notificacion ${eleccionesId}`);
    
  } catch (error) {
    console.error('Error al crear evento de prueba:', error);
  } finally {
    await sequelize.close();
  }
}

crearEventoPrueba(); 