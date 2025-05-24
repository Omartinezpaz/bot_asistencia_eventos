const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configurar la conexión a la base de datos
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false, // Desactivar logging para mayor claridad
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

async function verificarRoles() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.\n');

    // Consultar todos los participantes
    const [participantes] = await sequelize.query(`
      SELECT id, telegramid, nac, cedula, firstname, lastname, username, rol
      FROM notif_eventos_bot.participants
      ORDER BY id ASC;
    `);
    
    console.log(`Total de participantes registrados: ${participantes.length}\n`);
    
    // Mostrar información de los participantes
    if (participantes.length === 0) {
      console.log('No hay participantes registrados.');
    } else {
      console.log('Lista de participantes:');
      console.table(participantes.map(p => ({
        ID: p.id,
        'Telegram ID': p.telegramid,
        'Cédula': `${p.nac}-${p.cedula}`,
        'Nombre': `${p.firstname || ''} ${p.lastname || ''}`.trim(),
        'Usuario': p.username || 'N/A',
        'Rol': p.rol || 'user'
      })));
    }
    
    // Mostrar estadísticas de roles
    const roles = {};
    participantes.forEach(p => {
      const rol = p.rol || 'user';
      roles[rol] = (roles[rol] || 0) + 1;
    });
    
    console.log('\nEstadísticas de roles:');
    Object.entries(roles).forEach(([rol, cantidad]) => {
      console.log(`- ${rol}: ${cantidad} usuario(s)`);
    });
    
    // Verificar si hay al menos un administrador
    const adminCount = roles['admin'] || 0;
    if (adminCount === 0) {
      console.log('\n⚠️ ADVERTENCIA: No hay usuarios con rol de administrador.');
      console.log('Para asignar un administrador, ejecuta el siguiente comando en el bot:');
      console.log('/asignar_rol <cedula> admin');
    } else {
      console.log('\n✅ Hay al menos un administrador configurado.');
    }
    
  } catch (error) {
    console.error('Error al verificar roles:', error);
  } finally {
    await sequelize.close();
  }
}

verificarRoles(); 