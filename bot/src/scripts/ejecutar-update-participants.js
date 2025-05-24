const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Leer el archivo SQL
const sqlFilePath = path.join(__dirname, 'update-participants-schema.sql');
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

    console.log('Ejecutando script SQL para actualizar la tabla participants...');
    await sequelize.query(sqlContent);
    
    console.log('Script ejecutado correctamente.');
    
    // Verificar la estructura actualizada
    console.log('\nVerificando la estructura de la tabla participants:');
    const [columnas] = await sequelize.query(`
      SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'notif_eventos_bot' AND table_name = 'participants'
      ORDER BY ordinal_position;
    `);
    
    console.table(columnas);
    
    // Verificar los participantes con rol admin
    console.log('\nParticipantes con rol de administrador:');
    const [admins] = await sequelize.query(`
      SELECT id, telegramid, nac, cedula, firstname, lastname, username, rol
      FROM notif_eventos_bot.participants
      WHERE rol = 'admin';
    `);
    
    if (admins.length === 0) {
      console.log('No se encontraron participantes con rol de administrador.');
    } else {
      console.table(admins);
    }
    
  } catch (error) {
    console.error('Error al ejecutar el script:', error);
  } finally {
    await sequelize.close();
  }
}

ejecutarScript(); 