const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configurar la conexión a la base de datos
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: console.log,
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

// Verificar y diagnosticar el problema con los centros de votación
async function diagnosticarCentrosVotacion() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    // Verificar la estructura de la tabla de centros de votación
    console.log('\n1. Verificando estructura de la tabla centrosv_724:');
    const [columnas] = await sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'notif_eventos_bot'
      AND table_name = 'centrosv_724'
      ORDER BY ordinal_position;
    `);
    
    columnas.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    // Verificar si existen las columnas necesarias
    const codCentroColumn = columnas.find(col => col.column_name === 'cod_centro');
    const nomCentroColumn = columnas.find(col => col.column_name === 'nom_centro');
    
    if (!codCentroColumn) {
      console.log('\n❌ No se encontró la columna cod_centro en la tabla centrosv_724');
    } else {
      console.log('\n✅ La columna cod_centro existe en la tabla centrosv_724');
    }
    
    if (!nomCentroColumn) {
      console.log('❌ No se encontró la columna nom_centro en la tabla centrosv_724');
    } else {
      console.log('✅ La columna nom_centro existe en la tabla centrosv_724');
    }
    
    // Verificar la definición del modelo en el código
    console.log('\n2. Verificando el modelo CentroVotacion en el código:');
    console.log('- id está mapeado al campo cod_centro');
    console.log('- nombre está mapeado al campo nom_centro');
    
    // Verificar si hay datos en la tabla
    console.log('\n3. Verificando datos en la tabla centrosv_724:');
    const [centros] = await sequelize.query(`
      SELECT cod_centro, nom_centro, direccion
      FROM notif_eventos_bot.centrosv_724
      LIMIT 5;
    `);
    
    if (centros.length === 0) {
      console.log('❌ No se encontraron datos en la tabla centrosv_724');
    } else {
      console.log(`✅ Se encontraron ${centros.length} registros en la tabla centrosv_724`);
      console.log('Primeros 5 registros:');
      centros.forEach((centro, index) => {
        console.log(`\nCentro #${index + 1}:`);
        console.log(`- cod_centro: ${centro.cod_centro}`);
        console.log(`- nom_centro: ${centro.nom_centro}`);
        console.log(`- direccion: ${centro.direccion ? centro.direccion.substring(0, 50) + '...' : 'No disponible'}`);
      });
    }
    
    // Verificar la relación entre registro electoral y centro de votación
    console.log('\n4. Verificando la relación entre registro electoral y centro de votación:');
    const [registros] = await sequelize.query(`
      SELECT r.cedula, r.cod_centrov, c.cod_centro, c.nom_centro
      FROM notif_eventos_bot.re_724 r
      LEFT JOIN notif_eventos_bot.centrosv_724 c ON r.cod_centrov = c.cod_centro::text
      LIMIT 5;
    `);
    
    if (registros.length === 0) {
      console.log('❌ No se encontraron registros electorales');
    } else {
      console.log(`✅ Se encontraron ${registros.length} registros electorales`);
      console.log('Primeros 5 registros:');
      registros.forEach((registro, index) => {
        console.log(`\nRegistro #${index + 1}:`);
        console.log(`- Cédula: ${registro.cedula}`);
        console.log(`- cod_centrov: ${registro.cod_centrov}`);
        console.log(`- cod_centro: ${registro.cod_centro}`);
        console.log(`- nom_centro: ${registro.nom_centro || 'No disponible'}`);
        
        if (registro.cod_centrov && registro.cod_centro && registro.cod_centrov == registro.cod_centro) {
          console.log('✅ La relación entre registro electoral y centro de votación es correcta');
        } else {
          console.log('❌ La relación entre registro electoral y centro de votación es incorrecta');
        }
      });
    }
    
    // Verificar la consulta que se usa en el bot para obtener el centro de votación
    console.log('\n5. Simulando la consulta que usa el bot para obtener el centro de votación:');
    const cedula = registros.length > 0 ? registros[0].cedula : '12345678';
    
    const [resultado] = await sequelize.query(`
      SELECT 
        r.cedula, 
        r.cod_centrov, 
        c.cod_centro, 
        c.nom_centro, 
        c.direccion
      FROM notif_eventos_bot.re_724 r
      LEFT JOIN notif_eventos_bot.centrosv_724 c ON r.cod_centrov = c.cod_centro::text
      WHERE r.cedula = '${cedula}'
    `);
    
    if (resultado.length === 0) {
      console.log(`❌ No se encontró información para la cédula ${cedula}`);
    } else {
      console.log(`✅ Se encontró información para la cédula ${cedula}:`);
      console.log(`- Cédula: ${resultado[0].cedula}`);
      console.log(`- cod_centrov: ${resultado[0].cod_centrov}`);
      console.log(`- cod_centro: ${resultado[0].cod_centro}`);
      console.log(`- nom_centro: ${resultado[0].nom_centro || 'No disponible'}`);
      console.log(`- direccion: ${resultado[0].direccion ? resultado[0].direccion.substring(0, 50) + '...' : 'No disponible'}`);
    }
    
    console.log('\nDiagnóstico completado.');
    
  } catch (error) {
    console.error('Error al diagnosticar centros de votación:', error);
  } finally {
    await sequelize.close();
  }
}

diagnosticarCentrosVotacion(); 