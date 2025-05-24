const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configurar la conexión a la base de datos
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  schema: 'notif_eventos_bot'
});

async function consultarCentro() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    console.log('Consultando un centro de votación...');
    const [results] = await sequelize.query('SELECT cod_centro, nom_centro, direccion FROM notif_eventos_bot.centrosv_724 LIMIT 1');
    
    console.log('Centro de votación:');
    console.log(results[0]);
  } catch (error) {
    console.error('Error al consultar el centro de votación:', error);
  } finally {
    await sequelize.close();
  }
}

consultarCentro(); 