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

// Verificar y corregir la tabla de asistencias
async function corregirTablaAsistencias() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    // Verificar si existen las columnas correctas en la tabla de asistencias
    const [columnas] = await sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'notif_eventos_bot'
      AND table_name = 'attendances';
    `);
    
    console.log('Columnas encontradas en la tabla attendances:');
    columnas.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    // Verificar si existen las columnas ParticipantId y EventId
    const participantIdColumn = columnas.find(col => col.column_name.toLowerCase() === 'participantid');
    const eventIdColumn = columnas.find(col => col.column_name.toLowerCase() === 'eventid');
    
    if (!participantIdColumn) {
      console.log('\n❌ No se encontró la columna participantid. Agregándola...');
      await sequelize.query(`
        ALTER TABLE notif_eventos_bot.attendances 
        ADD COLUMN participantid INTEGER;
      `);
      console.log('✅ Columna participantid agregada correctamente');
    }
    
    if (!eventIdColumn) {
      console.log('\n❌ No se encontró la columna eventid. Agregándola...');
      await sequelize.query(`
        ALTER TABLE notif_eventos_bot.attendances 
        ADD COLUMN eventid INTEGER;
      `);
      console.log('✅ Columna eventid agregada correctamente');
    }
    
    // Verificar si hay registros en la tabla
    const [asistencias] = await sequelize.query(`
      SELECT * FROM notif_eventos_bot.attendances;
    `);
    
    console.log(`\nRegistros de asistencia encontrados: ${asistencias.length}`);
    
    // Verificar si hay eventos activos
    const [eventos] = await sequelize.query(`
      SELECT id, name, date FROM notif_eventos_bot.events 
      WHERE active = true 
      ORDER BY date ASC;
    `);
    
    console.log(`\nEventos activos encontrados: ${eventos.length}`);
    eventos.forEach(evento => {
      console.log(`- ID ${evento.id}: ${evento.name} (${new Date(evento.date).toLocaleString()})`);
    });
    
    // Verificar si hay participantes registrados
    const [participantes] = await sequelize.query(`
      SELECT id, telegramid, cedula, firstname, lastname FROM notif_eventos_bot.participants;
    `);
    
    console.log(`\nParticipantes registrados: ${participantes.length}`);
    
    // Verificar las relaciones entre tablas
    console.log('\nVerificando relaciones entre tablas...');
    
    // Crear índices para mejorar el rendimiento si no existen
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_attendances_participantid 
        ON notif_eventos_bot.attendances (participantid);
      `);
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_attendances_eventid 
        ON notif_eventos_bot.attendances (eventid);
      `);
      
      console.log('✅ Índices creados o verificados correctamente');
    } catch (error) {
      console.error('Error al crear índices:', error);
    }
    
    console.log('\nVerificación y corrección completadas.');
    
  } catch (error) {
    console.error('Error al corregir tabla de asistencias:', error);
  } finally {
    await sequelize.close();
  }
}

corregirTablaAsistencias(); 