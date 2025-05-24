require('dotenv').config();
const { RegistroElectoral, sequelize } = require('./src/database');

async function addCedula() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    // Verificar si ya existe el registro
    const existingRecord = await RegistroElectoral.findOne({
      where: { cedula: 12311614 }
    });

    if (existingRecord) {
      console.log('El registro con cédula 12311614 ya existe en la base de datos.');
      return;
    }

    // Agregar el registro electoral
    console.log('Insertando registro electoral con cédula 12311614...');
    await RegistroElectoral.create({
      nac: 'V',
      cedula_ch: '12311614',
      p_apellido: 'MARTÍNEZ',
      s_apellido: 'PAZ',
      p_nombre: 'OSCAR',
      s_nombre: 'JOSÉ',
      sexo: 'M',
      fecha_nac: '1975-08-15',
      cod_estado: '01',
      cod_municipio: '01',
      cod_parroquia: '01',
      cod_centrov: '100',
      cedula: 12311614
    });

    console.log('Registro insertado correctamente.');
  } catch (error) {
    console.error('Error al insertar el registro:', error);
  } finally {
    // Cerrar la conexión
    await sequelize.close();
    console.log('Conexión cerrada.');
  }
}

// Ejecutar la función
addCedula().catch(err => {
  console.error('Error general:', err);
  process.exit(1);
}); 