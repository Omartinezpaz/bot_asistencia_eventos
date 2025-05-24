const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Leer el archivo SQL
const sqlFilePath = path.join(__dirname, 'update-schema-notificaciones.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

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

// Ejecutar el script SQL
async function ejecutarScript() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    console.log('Ejecutando script SQL para crear tabla de notificaciones...');
    await sequelize.query(sqlContent);
    
    console.log('Script ejecutado correctamente.');
    
    // Verificar que la tabla se ha creado correctamente
    const [tablas] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'notif_eventos_bot' AND table_name = 'scheduled_notifications'
    `);
    
    if (tablas.length > 0) {
      console.log('✅ Tabla de notificaciones programadas creada correctamente.');
      
      // Verificar los campos de la tabla
      const [columnas] = await sequelize.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'scheduled_notifications'
        ORDER BY ordinal_position
      `);
      
      console.log('\nEstructura de la tabla:');
      columnas.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}`);
      });
      
      // Verificar los campos añadidos a la tabla de eventos
      const [columnasEventos] = await sequelize.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'notif_eventos_bot' AND table_name = 'events' 
        AND column_name IN ('notification_enabled', 'notification_hours_before')
      `);
      
      console.log('\nCampos añadidos a la tabla de eventos:');
      columnasEventos.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('❌ Error: No se pudo crear la tabla de notificaciones programadas.');
    }
  } catch (error) {
    console.error('Error al ejecutar el script:', error);
  } finally {
    await sequelize.close();
  }
}

ejecutarScript(); 