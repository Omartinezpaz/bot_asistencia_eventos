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

async function actualizarRoles() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.\n');

    // Consultar participantes con rol "usuario" o NULL
    const [participantesAntiguos] = await sequelize.query(`
      SELECT id, telegramid, nac, cedula, firstname, lastname, username, rol
      FROM notif_eventos_bot.participants
      WHERE rol = 'usuario' OR rol IS NULL
      ORDER BY id ASC;
    `);
    
    console.log(`Participantes con rol antiguo encontrados: ${participantesAntiguos.length}\n`);
    
    if (participantesAntiguos.length === 0) {
      console.log('No hay participantes con roles antiguos para actualizar.');
    } else {
      console.log('Lista de participantes a actualizar:');
      console.table(participantesAntiguos.map(p => ({
        ID: p.id,
        'Telegram ID': p.telegramid,
        'Cédula': `${p.nac}-${p.cedula}`,
        'Nombre': `${p.firstname || ''} ${p.lastname || ''}`.trim(),
        'Usuario': p.username || 'N/A',
        'Rol Actual': p.rol || 'NULL'
      })));
      
      // Actualizar los roles
      const [updateResult] = await sequelize.query(`
        UPDATE notif_eventos_bot.participants
        SET rol = 'user'
        WHERE rol = 'usuario' OR rol IS NULL;
      `);
      
      console.log(`\n✅ Roles actualizados: ${updateResult.rowCount || 'N/A'} participantes`);
    }
    
    // Verificar los roles actuales
    console.log('\nVerificando roles actuales:');
    const [participantesActualizados] = await sequelize.query(`
      SELECT rol, COUNT(*) as cantidad
      FROM notif_eventos_bot.participants
      GROUP BY rol
      ORDER BY rol;
    `);
    
    console.table(participantesActualizados);
    
  } catch (error) {
    console.error('Error al actualizar roles:', error);
  } finally {
    await sequelize.close();
  }
}

actualizarRoles(); 