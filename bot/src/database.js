const { Sequelize, DataTypes } = require('sequelize');

// Inicializar Sequelize con la URL de la base de datos (SQLite o PostgreSQL)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: process.env.NODE_ENV !== 'production',
  dialectOptions: process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') && process.env.NODE_ENV === 'production' 
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } 
    : {},
  schema: 'notif_eventos_bot' // Usar el esquema específico para PostgreSQL
});

// Definir los modelos
// Datos geográficos
const Geografia = sequelize.define('Geografia', {
  cod_estado: {
    type: DataTypes.INTEGER
  },
  cod_municipio: {
    type: DataTypes.INTEGER
  },
  cod_parroquia: {
    type: DataTypes.INTEGER
  },
  nom_estado: {
    type: DataTypes.STRING(35)
  },
  nom_municipio: {
    type: DataTypes.STRING(35)
  },
  nom_parroquia: {
    type: DataTypes.STRING(35)
  }
}, {
  tableName: 'geo_724',
  schema: 'notif_eventos_bot',
  timestamps: false
});

// Centro de votación
const CentroVotacion = sequelize.define('CentroVotacion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'cod_centro'
  },
  cod_viej_cv: {
    type: DataTypes.INTEGER
  },
  condicion: {
    type: DataTypes.INTEGER
  },
  cod_estado: {
    type: DataTypes.INTEGER
  },
  cod_municipio: {
    type: DataTypes.INTEGER
  },
  cod_parroquia: {
    type: DataTypes.INTEGER
  },
  nombre: {
    type: DataTypes.STRING(255),
    field: 'nom_centro'
  },
  direccion: {
    type: DataTypes.STRING(755)
  },
  plantel_mppe: {
    type: DataTypes.STRING(2)
  },
  latitud: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  longitud: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  proveedor_geo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  ultima_actualizacion_geo: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'centrosv_724',
  schema: 'notif_eventos_bot',
  timestamps: false
});

// Registro Electoral
const RegistroElectoral = sequelize.define('RegistroElectoral', {
  nac: {
    type: DataTypes.STRING(1)
  },
  cedula_ch: {
    type: DataTypes.STRING(9)
  },
  p_apellido: {
    type: DataTypes.STRING(35)
  },
  s_apellido: {
    type: DataTypes.STRING(35)
  },
  p_nombre: {
    type: DataTypes.STRING(35)
  },
  s_nombre: {
    type: DataTypes.STRING(35)
  },
  sexo: {
    type: DataTypes.STRING(2)
  },
  fecha_nac: {
    type: DataTypes.DATE
  },
  cod_estado: {
    type: DataTypes.STRING(2)
  },
  cod_municipio: {
    type: DataTypes.STRING(2)
  },
  cod_parroquia: {
    type: DataTypes.STRING(2)
  },
  cod_centrov: {
    type: DataTypes.STRING(10)
  },
  cedula: {
    type: DataTypes.INTEGER,
    unique: true
  }
}, {
  tableName: 're_724',
  schema: 'notif_eventos_bot',
  timestamps: false
});

// Participante (para el bot)
const Participante = sequelize.define('Participante', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegramId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
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
  }
}, {
  tableName: 'participants',
  schema: 'notif_eventos_bot',
  createdAt: 'createdat',
  updatedAt: 'updatedat'
});

// Eventos
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
  }
}, {
  tableName: 'events',
  schema: 'notif_eventos_bot',
  createdAt: 'createdat',
  updatedAt: 'updatedat'
});

// Asistencia
const Asistencia = sequelize.define('Asistencia', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'confirmado'
  },
  registeredAt: {
    type: DataTypes.DATE,
    field: 'registeredat',
    defaultValue: DataTypes.NOW
  },
  notes: DataTypes.TEXT
}, {
  tableName: 'attendances',
  schema: 'notif_eventos_bot',
  createdAt: 'createdat',
  updatedAt: 'updatedat'
});

// Notificaciones programadas
const NotificacionProgramada = sequelize.define('NotificacionProgramada', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  notification_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  message_template: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  scheduled_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sent_date: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'scheduled_notifications',
  schema: 'notif_eventos_bot',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Configuraciones del sistema
const AppSettings = sequelize.define('AppSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(255)
  },
  data_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'string'
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  organization_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'app_settings',
  schema: 'notif_eventos_bot',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Estadísticas de notificaciones
const NotificacionEstadistica = sequelize.define('NotificacionEstadistica', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  notification_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  participant_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  responded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  error_message: {
    type: DataTypes.TEXT
  },
  sent_date: {
    type: DataTypes.DATE
  },
  delivered_date: {
    type: DataTypes.DATE
  },
  read_date: {
    type: DataTypes.DATE
  },
  response_date: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'notification_stats',
  schema: 'notif_eventos_bot',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Modelo de Organización
const Organizacion = sequelize.define('Organizacion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  contact_email: {
    type: DataTypes.STRING(100)
  },
  contact_phone: {
    type: DataTypes.STRING(20)
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

// Modelo de Administradores de Organización
const OrganizacionAdmin = sequelize.define('OrganizacionAdmin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  participant_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  organization_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(20),
    defaultValue: 'admin'
  }
}, {
  tableName: 'organization_admins',
  schema: 'notif_eventos_bot',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Establecer relaciones
// Participante - Evento (a través de Asistencia)
Participante.belongsToMany(Evento, { through: Asistencia, foreignKey: 'participantid' });
Evento.belongsToMany(Participante, { through: Asistencia, foreignKey: 'eventid' });

// Agregar relaciones directas para que Asistencia pueda incluir Evento y Participante
Asistencia.belongsTo(Evento, { foreignKey: 'eventid' });
Evento.hasMany(Asistencia, { foreignKey: 'eventid' });

Asistencia.belongsTo(Participante, { foreignKey: 'participantid' });
Participante.hasMany(Asistencia, { foreignKey: 'participantid' });

// Evento - NotificacionProgramada
Evento.hasMany(NotificacionProgramada, { foreignKey: 'event_id' });
NotificacionProgramada.belongsTo(Evento, { foreignKey: 'event_id' });

// NotificacionProgramada - NotificacionEstadistica
NotificacionProgramada.hasMany(NotificacionEstadistica, { foreignKey: 'notification_id' });
NotificacionEstadistica.belongsTo(NotificacionProgramada, { foreignKey: 'notification_id' });

// Participante - NotificacionEstadistica
Participante.hasMany(NotificacionEstadistica, { foreignKey: 'participant_id' });
NotificacionEstadistica.belongsTo(Participante, { foreignKey: 'participant_id' });

// Geografía - Centro de Votación
Geografia.hasMany(CentroVotacion, {
  foreignKey: 'cod_parroquia',
  sourceKey: 'cod_parroquia',
  constraints: false
});
CentroVotacion.belongsTo(Geografia, {
  foreignKey: 'cod_parroquia',
  targetKey: 'cod_parroquia',
  constraints: false
});

// Registro Electoral - Centro de Votación
RegistroElectoral.belongsTo(CentroVotacion, {
  foreignKey: 'cod_centrov',
  targetKey: 'id',
  constraints: false
});
CentroVotacion.hasMany(RegistroElectoral, {
  foreignKey: 'cod_centrov',
  sourceKey: 'id',
  constraints: false
});

// Relaciones para Organización
Organizacion.hasMany(Participante, { foreignKey: 'organization_id' });
Participante.belongsTo(Organizacion, { foreignKey: 'organization_id' });

Organizacion.hasMany(Evento, { foreignKey: 'organization_id' });
Evento.belongsTo(Organizacion, { foreignKey: 'organization_id' });

// Relaciones para OrganizacionAdmin
Organizacion.hasMany(OrganizacionAdmin, { foreignKey: 'organization_id' });
OrganizacionAdmin.belongsTo(Organizacion, { foreignKey: 'organization_id' });

Participante.hasMany(OrganizacionAdmin, { foreignKey: 'participant_id' });
OrganizacionAdmin.belongsTo(Participante, { foreignKey: 'participant_id' });

// Relaciones para AppSettings
Organizacion.hasMany(AppSettings, { foreignKey: 'organization_id' });
AppSettings.belongsTo(Organizacion, { foreignKey: 'organization_id' });

// Función para configurar la base de datos
const setupDatabase = async () => {
  try {
    // Autenticar la conexión a la base de datos
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida correctamente.');
    
    // Verificar si existe el esquema (solo para PostgreSQL)
    if (sequelize.options.dialect === 'postgres') {
      await sequelize.query(`CREATE SCHEMA IF NOT EXISTS notif_eventos_bot`);
      console.log('Esquema notif_eventos_bot verificado o creado.');
    }
    
    // Sincronizar los modelos con la base de datos (deshabilitado para evitar errores)
    // await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    console.log('Sincronización de modelos deshabilitada para evitar conflictos.');

    // Verificar si hay datos geográficos
    const countGeo = await Geografia.count();
    if (countGeo === 0) {
      console.log('No hay datos geográficos. Necesitas importarlos desde un archivo CSV o SQL.');
    }

    // Verificar si hay centros de votación
    const countCentros = await CentroVotacion.count();
    if (countCentros === 0) {
      console.log('No hay centros de votación. Necesitas importarlos desde un archivo CSV o SQL.');
    }

    // Añadir eventos de ejemplo si no hay ninguno
    const countEventos = await Evento.count();
    if (countEventos === 0) {
      await Evento.bulkCreate([
        {
          name: 'Conferencia Anual de Tecnología',
          description: 'Presentación de las últimas tendencias tecnológicas del año',
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días en el futuro
          location: 'Centro de Convenciones, Madrid',
          active: true
        },
        {
          name: 'Taller de Desarrollo Web',
          description: 'Aprende las mejores prácticas para el desarrollo web moderno',
          date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 días en el futuro
          location: 'Campus Tech, Barcelona',
          active: true
        },
        {
          name: 'Reunión de Networking',
          description: 'Conecta con profesionales del sector y expande tu red de contactos',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días en el futuro
          location: 'Espacio Coworking, Valencia',
          active: true
        }
      ]);
      console.log('Eventos de ejemplo creados.');
    }

    // Insertar un participante de ejemplo si no hay ninguno
    const countParticipantes = await Participante.count();
    if (countParticipantes === 0) {
      await Participante.create({
        telegramId: '123456789',
        nac: 'V',
        cedula: '12311614',
        firstName: 'Oscar José',
        lastName: 'Martínez Paz',
        phone: '04242050125'
      });
      console.log('Participante de ejemplo creado.');
    }
    
    // Verificar si hay organizaciones
    const countOrganizaciones = await Organizacion.count();
    if (countOrganizaciones === 0) {
      // Crear organización por defecto
      const organizacion = await Organizacion.create({
        name: 'Organización Principal',
        description: 'Organización principal del sistema',
        contact_email: 'contacto@organizacion.com',
        contact_phone: '04242050125',
        active: true
      });
      console.log('Organización por defecto creada.');
      
      // Asignar todos los eventos existentes a la organización
      await Evento.update(
        { organization_id: organizacion.id },
        { where: { organization_id: null } }
      );
      
      // Buscar el ID de Telegram del administrador en el archivo .env
      const adminTelegramId = process.env.ADMIN_TELEGRAM_ID || '5694130379';
      
      // Buscar o crear el participante administrador
      let adminParticipante = await Participante.findOne({
        where: { telegramId: adminTelegramId }
      });
      
      if (!adminParticipante) {
        adminParticipante = await Participante.create({
          telegramId: adminTelegramId,
          nac: 'V',
          cedula: '12345678',
          firstName: 'Administrador',
          lastName: 'Sistema',
          rol: 'admin'
        });
        console.log('Participante administrador creado.');
      }
      
      // Asignar el participante a la organización
      await adminParticipante.update({ organization_id: organizacion.id });
      
      // Crear registro de administrador de organización
      const countAdmins = await OrganizacionAdmin.count();
      if (countAdmins === 0) {
        await OrganizacionAdmin.create({
          participant_id: adminParticipante.id,
          organization_id: organizacion.id,
          role: 'super_admin'
        });
        console.log('Administrador de organización creado.');
      }
    }
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
  }
};

module.exports = {
  sequelize,
  Geografia,
  CentroVotacion,
  RegistroElectoral,
  Participante,
  Evento,
  Asistencia,
  NotificacionProgramada,
  NotificacionEstadistica,
  Organizacion,
  OrganizacionAdmin,
  AppSettings,
  setupDatabase
}; 