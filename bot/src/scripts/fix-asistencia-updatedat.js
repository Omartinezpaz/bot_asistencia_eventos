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

// Verificar y corregir la columna updatedat en la tabla de asistencias
async function corregirColumnaUpdatedat() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    // Verificar si existe la columna updatedat
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
    
    // Verificar si existe la columna updatedat
    const updatedatColumn = columnas.find(col => col.column_name.toLowerCase() === 'updatedat');
    
    if (!updatedatColumn) {
      console.log('\n❌ No se encontró la columna updatedat. Agregándola...');
      await sequelize.query(`
        ALTER TABLE notif_eventos_bot.attendances 
        ADD COLUMN updatedat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ Columna updatedat agregada correctamente');
    } else {
      console.log('✅ La columna updatedat ya existe');
    }
    
    // Verificar si hay registros en la tabla
    const [asistencias] = await sequelize.query(`
      SELECT * FROM notif_eventos_bot.attendances;
    `);
    
    console.log(`\nRegistros de asistencia encontrados: ${asistencias.length}`);
    
    // Si hay registros pero no tienen updatedat, actualizarlos
    if (asistencias.length > 0 && !updatedatColumn) {
      console.log('Actualizando registros existentes con valor para updatedat...');
      await sequelize.query(`
        UPDATE notif_eventos_bot.attendances
        SET updatedat = registeredat
        WHERE updatedat IS NULL;
      `);
      console.log('✅ Registros actualizados correctamente');
    }
    
    console.log('\nVerificación y corrección completadas.');
    
  } catch (error) {
    console.error('Error al corregir columna updatedat:', error);
  } finally {
    await sequelize.close();
  }
}

corregirColumnaUpdatedat(); 