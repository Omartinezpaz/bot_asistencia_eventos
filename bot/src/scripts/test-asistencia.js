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

// Probar el registro de asistencia
async function probarRegistroAsistencia() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    // Obtener un participante de prueba
    const [participantes] = await sequelize.query(`
      SELECT id, telegramid, cedula, firstname, lastname 
      FROM notif_eventos_bot.participants 
      LIMIT 1;
    `);
    
    if (participantes.length === 0) {
      console.log('❌ No se encontraron participantes para la prueba');
      return;
    }
    
    const participante = participantes[0];
    console.log(`\nParticipante de prueba: ${participante.firstname} ${participante.lastname} (ID: ${participante.id})`);
    
    // Obtener un evento activo
    const [eventos] = await sequelize.query(`
      SELECT id, name, date 
      FROM notif_eventos_bot.events 
      WHERE active = true 
      ORDER BY date ASC 
      LIMIT 1;
    `);
    
    if (eventos.length === 0) {
      console.log('❌ No se encontraron eventos activos para la prueba');
      return;
    }
    
    const evento = eventos[0];
    console.log(`Evento de prueba: ${evento.name} (ID: ${evento.id})`);
    
    // Verificar si ya existe una asistencia para este participante y evento
    const [asistencias] = await sequelize.query(`
      SELECT id FROM notif_eventos_bot.attendances 
      WHERE participantid = $1 AND eventid = $2;
    `, {
      bind: [participante.id, evento.id]
    });
    
    if (asistencias.length > 0) {
      console.log(`\n⚠️ Ya existe un registro de asistencia para este participante y evento (ID: ${asistencias[0].id})`);
      console.log('Eliminando registro existente para la prueba...');
      
      await sequelize.query(`
        DELETE FROM notif_eventos_bot.attendances 
        WHERE participantid = $1 AND eventid = $2;
      `, {
        bind: [participante.id, evento.id]
      });
      
      console.log('✅ Registro eliminado correctamente');
    }
    
    // Registrar una nueva asistencia
    console.log('\nRegistrando nueva asistencia...');
    
    const [resultado] = await sequelize.query(`
      INSERT INTO notif_eventos_bot.attendances 
      (status, registeredat, participantid, eventid, createdat, updatedat) 
      VALUES ('asistió', CURRENT_TIMESTAMP, $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
      RETURNING id;
    `, {
      bind: [participante.id, evento.id]
    });
    
    console.log(`✅ Asistencia registrada correctamente con ID: ${resultado[0].id}`);
    
    // Verificar que se haya registrado correctamente
    const [verificacion] = await sequelize.query(`
      SELECT a.id, a.status, a.registeredat, 
             p.firstname, p.lastname, 
             e.name as event_name 
      FROM notif_eventos_bot.attendances a
      JOIN notif_eventos_bot.participants p ON a.participantid = p.id
      JOIN notif_eventos_bot.events e ON a.eventid = e.id
      WHERE a.id = $1;
    `, {
      bind: [resultado[0].id]
    });
    
    if (verificacion.length > 0) {
      const asistencia = verificacion[0];
      console.log('\nVerificación exitosa:');
      console.log(`- ID: ${asistencia.id}`);
      console.log(`- Participante: ${asistencia.firstname} ${asistencia.lastname}`);
      console.log(`- Evento: ${asistencia.event_name}`);
      console.log(`- Estado: ${asistencia.status}`);
      console.log(`- Fecha de registro: ${new Date(asistencia.registeredat).toLocaleString()}`);
    } else {
      console.log('❌ No se pudo verificar la asistencia registrada');
    }
    
  } catch (error) {
    console.error('Error al probar registro de asistencia:', error);
  } finally {
    await sequelize.close();
  }
}

probarRegistroAsistencia(); 