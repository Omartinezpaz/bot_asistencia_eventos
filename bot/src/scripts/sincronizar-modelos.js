require('dotenv').config({ path: '../../.env' });
const { sequelize, setupDatabase } = require('../database');

async function sincronizarModelos() {
  try {
    console.log('Iniciando sincronización de modelos...');
    
    // Conectar a la base de datos
    await setupDatabase();
    
    // Sincronizar modelos con la base de datos
    await sequelize.sync({ alter: true });
    
    console.log('Sincronización de modelos completada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error al sincronizar modelos:', error);
    process.exit(1);
  }
}

// Ejecutar la sincronización
sincronizarModelos(); 