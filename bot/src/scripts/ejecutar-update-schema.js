const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Leer el archivo SQL
const sqlFilePath = path.join(__dirname, 'update-centros-schema.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

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

// Ejecutar el script SQL
async function ejecutarScript() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    console.log('Ejecutando script SQL...');
    // Ejecutar el script SQL
    await sequelize.query(`
      -- Verificar si ya existen los campos para evitar errores
      DO $$
      BEGIN
          -- Añadir campo latitud si no existe
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'notif_eventos_bot' AND table_name = 'centrosv_724' AND column_name = 'latitud'
          ) THEN
              ALTER TABLE notif_eventos_bot.centrosv_724 ADD COLUMN latitud FLOAT;
              RAISE NOTICE 'Campo latitud añadido';
          ELSE
              RAISE NOTICE 'Campo latitud ya existe';
          END IF;

          -- Añadir campo longitud si no existe
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'notif_eventos_bot' AND table_name = 'centrosv_724' AND column_name = 'longitud'
          ) THEN
              ALTER TABLE notif_eventos_bot.centrosv_724 ADD COLUMN longitud FLOAT;
              RAISE NOTICE 'Campo longitud añadido';
          ELSE
              RAISE NOTICE 'Campo longitud ya existe';
          END IF;

          -- Añadir campo proveedor_geo si no existe
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'notif_eventos_bot' AND table_name = 'centrosv_724' AND column_name = 'proveedor_geo'
          ) THEN
              ALTER TABLE notif_eventos_bot.centrosv_724 ADD COLUMN proveedor_geo VARCHAR(50);
              RAISE NOTICE 'Campo proveedor_geo añadido';
          ELSE
              RAISE NOTICE 'Campo proveedor_geo ya existe';
          END IF;

          -- Añadir campo ultima_actualizacion_geo si no existe
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'notif_eventos_bot' AND table_name = 'centrosv_724' AND column_name = 'ultima_actualizacion_geo'
          ) THEN
              ALTER TABLE notif_eventos_bot.centrosv_724 ADD COLUMN ultima_actualizacion_geo TIMESTAMP;
              RAISE NOTICE 'Campo ultima_actualizacion_geo añadido';
          ELSE
              RAISE NOTICE 'Campo ultima_actualizacion_geo ya existe';
          END IF;
          
          -- Verificar coordenadas nulas o inválidas
          UPDATE notif_eventos_bot.centrosv_724
          SET latitud = NULL, longitud = NULL, proveedor_geo = NULL, ultima_actualizacion_geo = NULL
          WHERE latitud = 0 AND longitud = 0;
          RAISE NOTICE 'Coordenadas inválidas (0,0) corregidas';
          
          -- Configurar ultima_actualizacion_geo para los registros que ya tienen coordenadas
          UPDATE notif_eventos_bot.centrosv_724
          SET ultima_actualizacion_geo = CURRENT_TIMESTAMP,
              proveedor_geo = 'desconocido'
          WHERE latitud IS NOT NULL AND longitud IS NOT NULL AND ultima_actualizacion_geo IS NULL;
          RAISE NOTICE 'Registros con coordenadas actualizados';
          
          RAISE NOTICE 'Actualización de campos completada exitosamente';
      END $$;
    `);

    console.log('Creando índices...');
    // Crear índices
    await sequelize.query(`
      -- Crear un índice para mejorar la búsqueda de centros sin coordenadas (compatible con versiones anteriores)
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE schemaname = 'notif_eventos_bot' AND indexname = 'idx_centrosv_sin_coordenadas'
          ) THEN
              CREATE INDEX idx_centrosv_sin_coordenadas
              ON notif_eventos_bot.centrosv_724 ((latitud IS NULL OR longitud IS NULL));
              RAISE NOTICE 'Índice idx_centrosv_sin_coordenadas creado';
          ELSE
              RAISE NOTICE 'Índice idx_centrosv_sin_coordenadas ya existe';
          END IF;
      END $$;

      -- Crear un índice para búsquedas geográficas
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE schemaname = 'notif_eventos_bot' AND indexname = 'idx_centrosv_geografia'
          ) THEN
              CREATE INDEX idx_centrosv_geografia
              ON notif_eventos_bot.centrosv_724 (cod_estado, cod_municipio, cod_parroquia);
              RAISE NOTICE 'Índice idx_centrosv_geografia creado';
          ELSE
              RAISE NOTICE 'Índice idx_centrosv_geografia ya existe';
          END IF;
      END $$;
    `);

    // Consultar estadísticas
    const [estadisticas] = await sequelize.query(`
      SELECT 
          COUNT(*) AS total_centros,
          SUM(CASE WHEN latitud IS NULL OR longitud IS NULL THEN 1 ELSE 0 END) AS centros_sin_coordenadas,
          SUM(CASE WHEN latitud IS NOT NULL AND longitud IS NOT NULL THEN 1 ELSE 0 END) AS centros_con_coordenadas,
          COUNT(DISTINCT proveedor_geo) AS proveedores_usados
      FROM notif_eventos_bot.centrosv_724;
    `);

    console.log('Estadísticas:');
    console.log(estadisticas[0]);

    console.log('Script ejecutado correctamente.');
  } catch (error) {
    console.error('Error al ejecutar el script:', error);
  } finally {
    await sequelize.close();
  }
}

ejecutarScript(); 