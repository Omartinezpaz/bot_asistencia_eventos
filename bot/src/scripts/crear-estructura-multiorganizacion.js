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

// Implementar estructura para múltiples organizaciones
async function crearEstructuraMultiorganizacion() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');
    
    // 1. Crear tabla de organizaciones
    console.log('\n1. Creando tabla de organizaciones...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notif_eventos_bot.organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        logo_url VARCHAR(255),
        primary_color VARCHAR(20),
        secondary_color VARCHAR(20),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla de organizaciones creada correctamente');
    
    // 2. Añadir campo de organización a participantes
    console.log('\n2. Verificando si existe la columna organization_id en la tabla participants...');
    const [columnasParticipantes] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'notif_eventos_bot'
      AND table_name = 'participants'
      AND column_name = 'organization_id';
    `);
    
    if (columnasParticipantes.length === 0) {
      console.log('Añadiendo columna organization_id a la tabla participants...');
      await sequelize.query(`
        ALTER TABLE notif_eventos_bot.participants
        ADD COLUMN organization_id INTEGER REFERENCES notif_eventos_bot.organizations(id);
      `);
      console.log('✅ Columna organization_id añadida correctamente');
    } else {
      console.log('✅ La columna organization_id ya existe en la tabla participants');
    }
    
    // 3. Añadir campo de organización a eventos
    console.log('\n3. Verificando si existe la columna organization_id en la tabla events...');
    const [columnasEventos] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'notif_eventos_bot'
      AND table_name = 'events'
      AND column_name = 'organization_id';
    `);
    
    if (columnasEventos.length === 0) {
      console.log('Añadiendo columna organization_id a la tabla events...');
      await sequelize.query(`
        ALTER TABLE notif_eventos_bot.events
        ADD COLUMN organization_id INTEGER REFERENCES notif_eventos_bot.organizations(id);
      `);
      console.log('✅ Columna organization_id añadida correctamente');
    } else {
      console.log('✅ La columna organization_id ya existe en la tabla events');
    }
    
    // 4. Crear tabla de administradores de organizaciones
    console.log('\n4. Creando tabla de administradores de organizaciones...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notif_eventos_bot.organization_admins (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES notif_eventos_bot.organizations(id),
        participant_id INTEGER NOT NULL REFERENCES notif_eventos_bot.participants(id),
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, participant_id)
      );
    `);
    console.log('✅ Tabla de administradores de organizaciones creada correctamente');
    
    // 5. Crear índices para mejorar el rendimiento
    console.log('\n5. Creando índices para mejorar el rendimiento...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_participants_organization_id ON notif_eventos_bot.participants(organization_id);
      CREATE INDEX IF NOT EXISTS idx_events_organization_id ON notif_eventos_bot.events(organization_id);
    `);
    console.log('✅ Índices creados correctamente');
    
    // 6. Crear organización por defecto si no existe ninguna
    console.log('\n6. Verificando si existen organizaciones...');
    const [organizaciones] = await sequelize.query(`
      SELECT id, name FROM notif_eventos_bot.organizations;
    `);
    
    if (organizaciones.length === 0) {
      console.log('Creando organización por defecto...');
      await sequelize.query(`
        INSERT INTO notif_eventos_bot.organizations 
        (name, description, primary_color, secondary_color) 
        VALUES 
        ('Organización Principal', 'Organización por defecto del sistema', '#3498db', '#2ecc71');
      `);
      console.log('✅ Organización por defecto creada correctamente');
    } else {
      console.log(`✅ Ya existen ${organizaciones.length} organizaciones en el sistema`);
      organizaciones.forEach(org => {
        console.log(`- ID: ${org.id}, Nombre: ${org.name}`);
      });
    }
    
    // 7. Asignar todos los participantes y eventos existentes a la organización por defecto
    if (organizaciones.length === 0) {
      console.log('\n7. Asignando participantes y eventos existentes a la organización por defecto...');
      const [orgDefault] = await sequelize.query(`
        SELECT id FROM notif_eventos_bot.organizations ORDER BY id LIMIT 1;
      `);
      
      if (orgDefault.length > 0) {
        const orgId = orgDefault[0].id;
        
        await sequelize.query(`
          UPDATE notif_eventos_bot.participants
          SET organization_id = ${orgId}
          WHERE organization_id IS NULL;
        `);
        
        await sequelize.query(`
          UPDATE notif_eventos_bot.events
          SET organization_id = ${orgId}
          WHERE organization_id IS NULL;
        `);
        
        console.log('✅ Participantes y eventos asignados correctamente a la organización por defecto');
      }
    }
    
    console.log('\nEstructura multi-organización implementada correctamente');
    
  } catch (error) {
    console.error('Error al crear estructura multi-organización:', error);
  } finally {
    await sequelize.close();
  }
}

crearEstructuraMultiorganizacion(); 