require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../database');

async function ejecutarSQL() {
  try {
    console.log('Ejecutando script SQL...');
    
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'crear-tablas-organizacion.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Ejecutar el SQL
    await sequelize.query(sql);
    
    console.log('Script SQL ejecutado exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error al ejecutar script SQL:', error);
    process.exit(1);
  }
}

// Ejecutar el script
ejecutarSQL(); 