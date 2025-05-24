const { Sequelize, DataTypes } = require('sequelize');

/**
 * Definición corregida de modelos para Sequelize
 * Estos modelos están actualizados para coincidir exactamente con la estructura de la base de datos PostgreSQL
 */

module.exports = (sequelize) => {
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
    scheduled_date: {  // Nombre correcto de la columna en la base de datos
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

  // Organizaciones
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

  // Administradores de organización
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

  // Relaciones
  NotificacionProgramada.hasMany(NotificacionEstadistica, { foreignKey: 'notification_id' });
  NotificacionEstadistica.belongsTo(NotificacionProgramada, { foreignKey: 'notification_id' });

  Organizacion.hasMany(OrganizacionAdmin, { foreignKey: 'organization_id' });
  OrganizacionAdmin.belongsTo(Organizacion, { foreignKey: 'organization_id' });

  return {
    NotificacionProgramada,
    NotificacionEstadistica,
    Organizacion,
    OrganizacionAdmin
  };
}; 