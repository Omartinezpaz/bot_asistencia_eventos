// Definir modelo de Notificación Programada
const NotificacionProgramada = sequelize.define('NotificacionProgramada', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'events',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    notification_type: {
        type: Sequelize.STRING(50),
        allowNull: false
    },
    message_template: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    scheduled_date: {
        type: Sequelize.DATE,
        allowNull: false
    },
    sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    sent_date: {
        type: Sequelize.DATE,
        allowNull: true
    },
    created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },
    updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }
}, {
    tableName: 'scheduled_notifications',
    schema: 'notif_eventos_bot',
    timestamps: false // Desactivamos la gestión automática de timestamps porque los campos son created_at y updated_at
});

// Definir modelo de Estadísticas de Notificación
const NotificacionEstadistica = sequelize.define('NotificacionEstadistica', {
    notification_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
            model: 'scheduled_notifications',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    total: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    sent: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    delivered: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    read: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    responded: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    failed: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'notification_stats',
    schema: 'notif_eventos_bot'
});

// Definir modelo de Destinatarios de Notificación
const NotificacionDestinatario = sequelize.define('NotificacionDestinatario', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    notification_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'scheduled_notifications',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    participant_id: {
        type: Sequelize.INTEGER,
        references: {
            model: 'participants',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    telegram_id: {
        type: Sequelize.STRING(50)
    },
    status: {
        type: Sequelize.STRING(20),
        defaultValue: 'pending',
        allowNull: false
    },
    sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    sent_at: {
        type: Sequelize.DATE
    },
    delivered: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    delivered_at: {
        type: Sequelize.DATE
    },
    read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    read_at: {
        type: Sequelize.DATE
    },
    responded: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    response: {
        type: Sequelize.TEXT
    },
    response_at: {
        type: Sequelize.DATE
    }
}, {
    tableName: 'notification_recipients',
    schema: 'notif_eventos_bot'
});

// Asociaciones para notificaciones
NotificacionProgramada.belongsTo(Evento, { foreignKey: 'event_id' });
Evento.hasMany(NotificacionProgramada, { foreignKey: 'event_id' });

NotificacionProgramada.belongsTo(Organizacion, { foreignKey: 'organization_id' });
Organizacion.hasMany(NotificacionProgramada, { foreignKey: 'organization_id' });

NotificacionProgramada.hasOne(NotificacionEstadistica, { foreignKey: 'notification_id' });
NotificacionEstadistica.belongsTo(NotificacionProgramada, { foreignKey: 'notification_id' });

NotificacionProgramada.hasMany(NotificacionDestinatario, { foreignKey: 'notification_id' });
NotificacionDestinatario.belongsTo(NotificacionProgramada, { foreignKey: 'notification_id' });

NotificacionDestinatario.belongsTo(Participante, { foreignKey: 'participant_id' });
Participante.hasMany(NotificacionDestinatario, { foreignKey: 'participant_id' });

module.exports = {
    sequelize,
    Sequelize,
    Organizacion,
    Participante,
    Evento,
    Asistencia,
    NotificacionProgramada,
    NotificacionEstadistica,
    NotificacionDestinatario
}; 