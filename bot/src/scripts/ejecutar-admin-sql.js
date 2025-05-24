require('dotenv').config();
const { Pool } = require('pg');

async function actualizarAdmin() {
  const dbUrl = process.env.DATABASE_URL;
  console.log('URL de la base de datos:', dbUrl);

  if (!dbUrl) {
    console.error('Error: No se encontró DATABASE_URL en las variables de entorno');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  const client = await pool.connect();
  try {
    console.log('Conectado a la base de datos PostgreSQL');
    
    // Verificar si el usuario ya tiene rol de admin
    const checkRes = await client.query(
      'SELECT * FROM notif_eventos_bot.participants WHERE cedula = $1',
      ['12311614']
    );
    
    if (checkRes.rows.length === 0) {
      console.log('No se encontró ningún participante con cédula 12311614');
      // Intentar con el ID de Telegram como alternativa
      const altCheck = await client.query(
        'SELECT * FROM notif_eventos_bot.participants WHERE telegramid = $1',
        ['5694130379']
      );
      
      if (altCheck.rows.length === 0) {
        console.log('No se encontró ningún participante con Telegram ID 5694130379');
        
        // Crear el usuario administrador si no existe
        console.log('Creando nuevo usuario administrador...');
        await client.query(`
          INSERT INTO notif_eventos_bot.participants 
          (telegramid, nac, cedula, firstname, lastname, rol, createdat, updatedat) 
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, ['5694130379', 'V', '12311614', 'Oscar José', 'Martínez Paz', 'admin']);
        
        console.log('Usuario administrador creado exitosamente');
      } else {
        const user = altCheck.rows[0];
        console.log(`Usuario encontrado con Telegram ID: ${user.telegramid}`);
        console.log(`Rol actual: ${user.rol || 'user'}`);
        
        // Actualizar el rol a admin
        await client.query(
          'UPDATE notif_eventos_bot.participants SET rol = $1 WHERE id = $2',
          ['admin', user.id]
        );
        
        console.log('Rol actualizado a admin correctamente');
      }
    } else {
      const user = checkRes.rows[0];
      console.log(`Usuario encontrado: ${user.firstname} ${user.lastname}`);
      console.log(`Rol actual: ${user.rol || 'user'}`);
      
      if (user.rol === 'admin') {
        console.log('El usuario ya tiene rol de administrador');
      } else {
        // Actualizar el rol a admin
        await client.query(
          'UPDATE notif_eventos_bot.participants SET rol = $1 WHERE id = $2',
          ['admin', user.id]
        );
        
        console.log('Rol actualizado a admin correctamente');
      }
    }
    
    // Verificar todos los usuarios con rol admin
    const admins = await client.query(
      'SELECT * FROM notif_eventos_bot.participants WHERE rol = $1',
      ['admin']
    );
    
    console.log('\nUsuarios con rol de administrador:');
    admins.rows.forEach(admin => {
      console.log(`- ${admin.firstname} ${admin.lastname} (ID: ${admin.id}, Cédula: ${admin.cedula}, Telegram: ${admin.telegramid})`);
    });
    
    console.log('\nPuede acceder al panel administrativo en: http://localhost:3003/admin');
    console.log('Credenciales de acceso:');
    console.log('- Usuario: 12311614 o 5694130379');
    console.log('- Contraseña: [La configurada en el archivo .env como ADMIN_PASSWORD]');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

actualizarAdmin(); 