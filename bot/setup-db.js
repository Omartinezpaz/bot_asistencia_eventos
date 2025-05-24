require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('Iniciando configuración de la base de datos...');
  console.log('Variables de entorno cargadas:');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  // Extraer parámetros de conexión desde DATABASE_URL
  let dbParams = {};
  
  try {
    const dbUrl = process.env.DATABASE_URL;
    console.log('URL de la base de datos:', dbUrl);
    
    const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
    const match = dbUrl.match(regex);
    
    if (match) {
      dbParams = {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4]),
        database: match[5]
      };
      console.log('Parámetros de conexión:', {
        user: dbParams.user,
        host: dbParams.host,
        port: dbParams.port,
        database: dbParams.database
      });
    } else {
      throw new Error('No se pudo parsear DATABASE_URL');
    }
  } catch (error) {
    console.error('Error al parsear DATABASE_URL:', error);
    console.log('Usando parámetros por defecto...');
    
    dbParams = {
      user: 'omarte',
      password: 'Ap3r1t1v02025',
      host: 'localhost',
      port: 5432,
      database: 'notificaciones'
    };
    console.log('Parámetros de conexión por defecto:', {
      user: dbParams.user,
      host: dbParams.host,
      port: dbParams.port,
      database: dbParams.database
    });
  }

  console.log('Creando pool de conexiones...');
  const pool = new Pool(dbParams);

  try {
    // Conectar a la base de datos
    console.log('Intentando conectar a la base de datos...');
    const client = await pool.connect();
    console.log('Conexión a la base de datos establecida.');

    // Verificar si existe el esquema
    console.log('Verificando esquema notif_eventos_bot...');
    await client.query(`CREATE SCHEMA IF NOT EXISTS notif_eventos_bot`);
    console.log('Esquema notif_eventos_bot verificado o creado.');

    // Leer archivo SQL
    console.log('Leyendo archivo SQL...');
    const sqlFile = path.join(__dirname, 'init-db.sql');
    console.log('Ruta del archivo SQL:', sqlFile);
    
    if (fs.existsSync(sqlFile)) {
      console.log('El archivo SQL existe.');
      const sql = fs.readFileSync(sqlFile, 'utf8');
      console.log('Contenido SQL leído correctamente. Longitud:', sql.length);

      // Ejecutar script SQL
      console.log('Ejecutando script SQL...');
      await client.query(sql);
      console.log('Script SQL ejecutado correctamente.');
    } else {
      console.error('El archivo SQL no existe en la ruta especificada.');
    }

    // Liberar cliente
    client.release();
    console.log('Configuración de la base de datos completada correctamente.');
  } catch (err) {
    console.error('Error al configurar la base de datos:', err);
    console.error('Detalles del error:', err.message);
    if (err.stack) {
      console.error('Stack de error:', err.stack);
    }
  } finally {
    // Cerrar el pool
    console.log('Cerrando pool de conexiones...');
    await pool.end();
    console.log('Pool cerrado.');
  }
}

// Ejecutar la función
console.log('Iniciando script...');
setupDatabase().catch(err => {
  console.error('Error general:', err);
  process.exit(1);
}); 