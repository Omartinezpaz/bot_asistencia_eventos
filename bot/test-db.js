require('dotenv').config();
const { Pool } = require('pg');

async function testDatabaseConnection() {
  console.log('Iniciando prueba de conexión a la base de datos...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  // Parámetros de conexión
  const dbParams = {
    user: 'omarte',
    password: 'Ap3r1t1v02025',
    host: 'localhost',
    port: 5432,
    database: 'notificaciones'
  };
  
  console.log('Parámetros de conexión:', {
    user: dbParams.user,
    host: dbParams.host,
    port: dbParams.port,
    database: dbParams.database
  });
  
  const pool = new Pool(dbParams);
  
  try {
    console.log('Intentando conectar a la base de datos...');
    const client = await pool.connect();
    console.log('Conexión exitosa a la base de datos PostgreSQL.');
    
    // Probar una consulta simple
    const result = await client.query('SELECT current_database() as db_name');
    console.log('Base de datos actual:', result.rows[0].db_name);
    
    // Verificar si existe el esquema
    console.log('Intentando crear esquema si no existe...');
    await client.query('CREATE SCHEMA IF NOT EXISTS notif_eventos_bot');
    console.log('Esquema notif_eventos_bot verificado o creado.');
    
    // Liberar cliente
    client.release();
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error.message);
  } finally {
    await pool.end();
    console.log('Prueba de conexión finalizada.');
  }
}

// Ejecutar la prueba
testDatabaseConnection().catch(err => {
  console.error('Error general:', err.message);
}); 