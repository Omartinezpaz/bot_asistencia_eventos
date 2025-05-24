require('dotenv').config();
const { 
  Geografia, 
  CentroVotacion, 
  RegistroElectoral, 
  Participante, 
  Evento, 
  sequelize 
} = require('./src/database');

async function addSampleData() {
  try {
    console.log('Iniciando inserción de datos de ejemplo...');
    
    // Verificar conexión
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida correctamente.');
    
    // Datos geográficos
    const geografiaCount = await Geografia.count();
    if (geografiaCount === 0) {
      console.log('Insertando datos geográficos...');
      
      await Geografia.bulkCreate([
        { cod_estado: 1, cod_municipio: 1, cod_parroquia: 1, nom_estado: 'Distrito Capital', nom_municipio: 'Libertador', nom_parroquia: 'Catedral' },
        { cod_estado: 1, cod_municipio: 1, cod_parroquia: 2, nom_estado: 'Distrito Capital', nom_municipio: 'Libertador', nom_parroquia: 'San Juan' },
        { cod_estado: 1, cod_municipio: 1, cod_parroquia: 3, nom_estado: 'Distrito Capital', nom_municipio: 'Libertador', nom_parroquia: 'Santa Teresa' },
        { cod_estado: 2, cod_municipio: 1, cod_parroquia: 1, nom_estado: 'Amazonas', nom_municipio: 'Alto Orinoco', nom_parroquia: 'La Esmeralda' },
        { cod_estado: 3, cod_municipio: 1, cod_parroquia: 1, nom_estado: 'Anzoátegui', nom_municipio: 'Anaco', nom_parroquia: 'Anaco' },
        { cod_estado: 4, cod_municipio: 1, cod_parroquia: 1, nom_estado: 'Apure', nom_municipio: 'Achaguas', nom_parroquia: 'Achaguas' },
        { cod_estado: 5, cod_municipio: 1, cod_parroquia: 1, nom_estado: 'Aragua', nom_municipio: 'Girardot', nom_parroquia: 'Maracay' }
      ]);
      
      console.log('Datos geográficos insertados correctamente.');
    } else {
      console.log(`Ya existen ${geografiaCount} registros en la tabla Geografia.`);
    }
    
    // Centros de votación
    const centrosCount = await CentroVotacion.count();
    if (centrosCount === 0) {
      console.log('Insertando centros de votación...');
      
      await CentroVotacion.bulkCreate([
        { 
          cod_centro: 100, 
          cod_viej_cv: 100, 
          condicion: 1, 
          cod_estado: 1, 
          cod_municipio: 1, 
          cod_parroquia: 1, 
          nom_centro: 'U.E. SIMÓN BOLÍVAR', 
          direccion: 'AVENIDA PRINCIPAL, CATEDRAL', 
          plantel_mppe: 'SI',
          latitud: 10.5027, 
          longitud: -66.9108
        },
        { 
          cod_centro: 101, 
          cod_viej_cv: 101, 
          condicion: 1, 
          cod_estado: 1, 
          cod_municipio: 1, 
          cod_parroquia: 1, 
          nom_centro: 'LICEO ANDRÉS BELLO', 
          direccion: 'CALLE BOLÍVAR, CATEDRAL', 
          plantel_mppe: 'SI',
          latitud: 10.5032, 
          longitud: -66.9115
        },
        { 
          cod_centro: 102, 
          cod_viej_cv: 102, 
          condicion: 1, 
          cod_estado: 1, 
          cod_municipio: 1, 
          cod_parroquia: 2, 
          nom_centro: 'ESCUELA BÁSICA JOSÉ MARÍA VARGAS', 
          direccion: 'CALLE PRINCIPAL SAN JUAN', 
          plantel_mppe: 'SI',
          latitud: 10.5104, 
          longitud: -66.9229
        },
        { 
          cod_centro: 103, 
          cod_viej_cv: 103, 
          condicion: 1, 
          cod_estado: 1, 
          cod_municipio: 1, 
          cod_parroquia: 3, 
          nom_centro: 'ESCUELA TERESA CARREÑO', 
          direccion: 'SANTA TERESA, AVENIDA PRINCIPAL', 
          plantel_mppe: 'SI',
          latitud: 10.5061, 
          longitud: -66.9158
        },
        { 
          cod_centro: 104, 
          cod_viej_cv: 104, 
          condicion: 1, 
          cod_estado: 2, 
          cod_municipio: 1, 
          cod_parroquia: 1, 
          nom_centro: 'ESCUELA INDÍGENA LA ESMERALDA', 
          direccion: 'ALTO ORINOCO', 
          plantel_mppe: 'SI',
          latitud: 3.1655, 
          longitud: -65.5489
        },
        { 
          cod_centro: 105, 
          cod_viej_cv: 105, 
          condicion: 1, 
          cod_estado: 3, 
          cod_municipio: 1, 
          cod_parroquia: 1, 
          nom_centro: 'ESCUELA BÁSICA ANACO', 
          direccion: 'CALLE PRINCIPAL ANACO', 
          plantel_mppe: 'SI',
          latitud: 9.4358, 
          longitud: -64.4713
        },
        { 
          cod_centro: 106, 
          cod_viej_cv: 106, 
          condicion: 1, 
          cod_estado: 4, 
          cod_municipio: 1, 
          cod_parroquia: 1, 
          nom_centro: 'LICEO ACHAGUAS', 
          direccion: 'AVENIDA PRINCIPAL ACHAGUAS', 
          plantel_mppe: 'SI',
          latitud: 7.7702, 
          longitud: -68.2344
        },
        { 
          cod_centro: 107, 
          cod_viej_cv: 107, 
          condicion: 1, 
          cod_estado: 5, 
          cod_municipio: 1, 
          cod_parroquia: 1, 
          nom_centro: 'LICEO MARACAY', 
          direccion: 'CENTRO DE MARACAY', 
          plantel_mppe: 'SI',
          latitud: 10.2469, 
          longitud: -67.5986
        }
      ]);
      
      console.log('Centros de votación insertados correctamente.');
    } else {
      console.log(`Ya existen ${centrosCount} registros en la tabla CentroVotacion.`);
    }
    
    // Registro electoral
    const registrosCount = await RegistroElectoral.count();
    if (registrosCount === 0) {
      console.log('Insertando registros electorales...');
      
      await RegistroElectoral.bulkCreate([
        {
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
        },
        {
          nac: 'V',
          cedula_ch: '5555555',
          p_apellido: 'PÉREZ',
          s_apellido: 'PÉREZ',
          p_nombre: 'JUAN',
          s_nombre: 'CARLOS',
          sexo: 'M',
          fecha_nac: '1980-05-10',
          cod_estado: '01',
          cod_municipio: '01',
          cod_parroquia: '01',
          cod_centrov: '101',
          cedula: 5555555
        },
        {
          nac: 'V',
          cedula_ch: '6666666',
          p_apellido: 'GONZÁLEZ',
          s_apellido: 'RODRÍGUEZ',
          p_nombre: 'MARÍA',
          s_nombre: 'LUISA',
          sexo: 'F',
          fecha_nac: '1985-12-25',
          cod_estado: '01',
          cod_municipio: '01',
          cod_parroquia: '02',
          cod_centrov: '102',
          cedula: 6666666
        },
        {
          nac: 'V',
          cedula_ch: '7777777',
          p_apellido: 'CASTILLO',
          s_apellido: 'BLANCO',
          p_nombre: 'PEDRO',
          s_nombre: 'JOSÉ',
          sexo: 'M',
          fecha_nac: '1990-03-20',
          cod_estado: '01',
          cod_municipio: '01',
          cod_parroquia: '03',
          cod_centrov: '103',
          cedula: 7777777
        },
        {
          nac: 'V',
          cedula_ch: '8888888',
          p_apellido: 'MENDOZA',
          s_apellido: 'TORO',
          p_nombre: 'ANA',
          s_nombre: 'MARÍA',
          sexo: 'F',
          fecha_nac: '1982-07-30',
          cod_estado: '02',
          cod_municipio: '01',
          cod_parroquia: '01',
          cod_centrov: '104',
          cedula: 8888888
        },
        {
          nac: 'V',
          cedula_ch: '9999999',
          p_apellido: 'FERNÁNDEZ',
          s_apellido: 'SILVA',
          p_nombre: 'JOSÉ',
          s_nombre: 'LUIS',
          sexo: 'M',
          fecha_nac: '1978-09-18',
          cod_estado: '03',
          cod_municipio: '01',
          cod_parroquia: '01',
          cod_centrov: '105',
          cedula: 9999999
        },
        {
          nac: 'V',
          cedula_ch: '1111111',
          p_apellido: 'RAMÍREZ',
          s_apellido: 'MORA',
          p_nombre: 'LAURA',
          s_nombre: 'CAROLINA',
          sexo: 'F',
          fecha_nac: '1995-01-05',
          cod_estado: '04',
          cod_municipio: '01',
          cod_parroquia: '01',
          cod_centrov: '106',
          cedula: 1111111
        }
      ]);
      
      console.log('Registros electorales insertados correctamente.');
    } else {
      console.log(`Ya existen ${registrosCount} registros en la tabla RegistroElectoral.`);
    }
    
    // Eventos
    const eventosCount = await Evento.count();
    if (eventosCount === 0) {
      console.log('Insertando eventos...');
      
      await Evento.bulkCreate([
        {
          name: 'Elecciones Presidenciales',
          description: 'Jornada de votación para elegir al Presidente de la República',
          date: new Date('2024-07-28T08:00:00'),
          location: 'Nacional',
          active: true
        },
        {
          name: 'Capacitación de Testigos',
          description: 'Formación para testigos de mesa',
          date: new Date('2024-07-20T14:00:00'),
          location: 'Virtual',
          active: true
        },
        {
          name: 'Simulacro de Votación',
          description: 'Prueba del sistema de votación',
          date: new Date('2024-07-14T09:00:00'),
          location: 'Centros seleccionados',
          active: false
        }
      ]);
      
      console.log('Eventos insertados correctamente.');
    } else {
      console.log(`Ya existen ${eventosCount} registros en la tabla Evento.`);
    }
    
    // Participante ejemplo (si aún no existe)
    const participanteExistente = await Participante.findOne({
      where: { cedula: '12311614' }
    });
    
    if (!participanteExistente) {
      console.log('Insertando participante de ejemplo...');
      
      await Participante.create({
        telegramId: '123456789',
        nac: 'V',
        cedula: '12311614',
        firstName: 'Oscar José',
        lastName: 'Martínez Paz',
        phone: '04242050125'
      });
      
      console.log('Participante de ejemplo insertado correctamente.');
    } else {
      console.log('El participante de ejemplo ya existe.');
    }
    
    console.log('Proceso completado exitosamente.');
    
  } catch (error) {
    console.error('Error al insertar datos de ejemplo:', error);
  } finally {
    // Cerrar la conexión
    await sequelize.close();
  }
}

// Ejecutar la función
addSampleData().catch(err => {
  console.error('Error general:', err);
  process.exit(1);
}); 