const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Leer el archivo SQL
const sqlFilePath = path.join(__dirname, 'create-notification-stats.sql');
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

    console.log('Ejecutando script SQL para crear la tabla de estadísticas de notificaciones...');
    await sequelize.query(sqlContent);
    
    console.log('Script ejecutado correctamente.');
    
    // Verificar la estructura creada
    console.log('\nVerificando la estructura de la tabla notification_stats:');
    const [columnas] = await sequelize.query(`
      SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'notif_eventos_bot' AND table_name = 'notification_stats'
      ORDER BY ordinal_position;
    `);
    
    if (columnas.length === 0) {
      console.log('La tabla notification_stats no se ha creado correctamente.');
    } else {
      console.table(columnas);
      console.log('\nTabla notification_stats creada correctamente.');
    }
    
    // Verificar la vista
    console.log('\nVerificando la vista notification_stats_summary:');
    const [vistaExiste] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'notif_eventos_bot' AND table_name = 'notification_stats_summary';
    `);
    
    if (vistaExiste.length === 0) {
      console.log('La vista notification_stats_summary no se ha creado correctamente.');
    } else {
      console.log('Vista notification_stats_summary creada correctamente.');
    }
    
  } catch (error) {
    console.error('Error al ejecutar el script:', error);
  } finally {
    await sequelize.close();
  }
}

ejecutarScript(); 