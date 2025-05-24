const { Sequelize, DataTypes } = require('sequelize');
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

async function actualizarModelos() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');
    
    // Definir el modelo de Organización
    const Organizacion = sequelize.define('Organizacion', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT
      },
      logo_url: {
        type: DataTypes.STRING(255)
      },
      primary_color: {
        type: DataTypes.STRING(20)
      },
      secondary_color: {
        type: DataTypes.STRING(20)
      },
      contact_email: {
        type: DataTypes.STRING(255)
      },
      contact_phone: {
        type: DataTypes.STRING(50)
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      }
    }, {
      tableName: 'organizations',
      schema: 'notif_eventos_bot',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });
    
    // Definir el modelo de Administradores de Organización
    const OrganizacionAdmin = sequelize.define('OrganizacionAdmin', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      participant_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      role: {
        type: DataTypes.STRING(50),
        defaultValue: 'admin'
      }
    }, {
      tableName: 'organization_admins',
      schema: 'notif_eventos_bot',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });
    
    // Definir el modelo de Participante (existente, pero actualizado)
    const Participante = sequelize.define('Participante', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      telegramId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'telegramid'
      },
      nac: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      cedula: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      firstName: {
        type: DataTypes.STRING(100),
        field: 'firstname'
      },
      lastName: {
        type: DataTypes.STRING(100),
        field: 'lastname'
      },
      username: {
        type: DataTypes.STRING(100)
      },
      email: {
        type: DataTypes.STRING(255)
      },
      phone: {
        type: DataTypes.STRING(50)
      },
      rol: {
        type: DataTypes.STRING(20),
        defaultValue: 'user'
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      tableName: 'participants',
      schema: 'notif_eventos_bot',
      createdAt: 'createdat',
      updatedAt: 'updatedat'
    });
    
    // Definir el modelo de Evento (existente, pero actualizado)
    const Evento = sequelize.define('Evento', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: DataTypes.TEXT,
      date: {
        type: DataTypes.DATE,
        allowNull: false
      },
      location: DataTypes.STRING,
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      notification_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      notification_hours_before: {
        type: DataTypes.INTEGER,
        defaultValue: 24
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    }, {
      tableName: 'events',
      schema: 'notif_eventos_bot',
      createdAt: 'createdat',
      updatedAt: 'updatedat'
    });
    
    // Establecer relaciones
    
    // Organización - Participante
    Organizacion.hasMany(Participante, { foreignKey: 'organization_id' });
    Participante.belongsTo(Organizacion, { foreignKey: 'organization_id' });
    
    // Organización - Evento
    Organizacion.hasMany(Evento, { foreignKey: 'organization_id' });
    Evento.belongsTo(Organizacion, { foreignKey: 'organization_id' });
    
    // Organización - OrganizacionAdmin
    Organizacion.hasMany(OrganizacionAdmin, { foreignKey: 'organization_id' });
    OrganizacionAdmin.belongsTo(Organizacion, { foreignKey: 'organization_id' });
    
    // Participante - OrganizacionAdmin
    Participante.hasMany(OrganizacionAdmin, { foreignKey: 'participant_id' });
    OrganizacionAdmin.belongsTo(Participante, { foreignKey: 'participant_id' });
    
    // Sincronizar modelos con la base de datos
    await sequelize.sync({ alter: false }); // No alteramos las tablas, solo verificamos
    
    console.log('✅ Modelos actualizados correctamente');
    
    // Verificar las organizaciones existentes
    const organizaciones = await Organizacion.findAll();
    console.log(`\nOrganizaciones existentes: ${organizaciones.length}`);
    organizaciones.forEach(org => {
      console.log(`- ID: ${org.id}, Nombre: ${org.name}`);
    });
    
    // Verificar los administradores de organizaciones
    const admins = await OrganizacionAdmin.findAll({
      include: [
        { model: Organizacion },
        { model: Participante }
      ]
    });
    
    console.log(`\nAdministradores de organizaciones: ${admins.length}`);
    admins.forEach(admin => {
      console.log(`- Organización: ${admin.Organizacion?.name || 'N/A'}, Participante: ${admin.Participante?.firstName || 'N/A'} ${admin.Participante?.lastName || ''}, Rol: ${admin.role}`);
    });
    
    // Si no hay administradores, crear uno por defecto
    if (admins.length === 0 && organizaciones.length > 0) {
      console.log('\nCreando administrador por defecto...');
      
      // Buscar un participante con rol 'admin'
      const adminParticipante = await Participante.findOne({
        where: { rol: 'admin' }
      });
      
      if (adminParticipante) {
        await OrganizacionAdmin.create({
          organization_id: organizaciones[0].id,
          participant_id: adminParticipante.id,
          role: 'super_admin'
        });
        
        console.log(`✅ Administrador por defecto creado: ${adminParticipante.firstName} ${adminParticipante.lastName}`);
      } else {
        console.log('❌ No se encontró ningún participante con rol "admin" para asignar como administrador de organización');
      }
    }
    
    console.log('\nActualización de modelos completada');
    
  } catch (error) {
    console.error('Error al actualizar modelos:', error);
  } finally {
    await sequelize.close();
  }
}

actualizarModelos(); 