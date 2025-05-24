require('dotenv').config();
const { sequelize, Participante } = require('../database');

async function actualizarAdmin() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    // Buscar participante por cédula
    const cedula = '12311614'; // Cédula del participante a hacer admin
    
    console.log(`Buscando participante con cédula: ${cedula}`);
    const participante = await Participante.findOne({
      where: { cedula }
    });

    if (!participante) {
      console.log(`No se encontró ningún participante con cédula ${cedula}`);
      process.exit(1);
    }

    console.log(`Participante encontrado:`);
    console.log(`- ID: ${participante.id}`);
    console.log(`- Nombre: ${participante.firstName} ${participante.lastName}`);
    console.log(`- Cédula: ${participante.cedula}`);
    console.log(`- Telegram ID: ${participante.telegramId}`);
    console.log(`- Rol actual: ${participante.rol || 'user'}`);

    // Actualizar rol a administrador
    const rolAnterior = participante.rol || 'user';
    await participante.update({ rol: 'admin' });
    console.log(`\n¡Rol actualizado correctamente!`);
    console.log(`- Rol anterior: ${rolAnterior}`);
    console.log(`- Rol actual: ${participante.rol}`);

    console.log('\nEl participante ahora puede acceder al panel administrativo.');

    process.exit(0);
  } catch (error) {
    console.error('Error al actualizar administrador:', error);
    process.exit(1);
  }
}

actualizarAdmin(); 