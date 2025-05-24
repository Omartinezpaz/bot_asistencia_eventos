const { sequelize } = require('./db');

// Función para inicializar la base de datos
async function initializeDatabase() {
    try {
        console.log('Verificando tabla app_settings...');
        
        // Comprobar si la tabla app_settings existe
        const [tableExistsResult] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'app_settings'
            ) as exists
        `);
        
        // Extraer el valor booleano del resultado
        const tableExists = tableExistsResult[0]?.exists || false;
        
        if (!tableExists) {
            console.log('Creando tabla app_settings...');
            await sequelize.query(`
                CREATE TABLE app_settings (
                    id SERIAL PRIMARY KEY,
                    key VARCHAR(100) NOT NULL,
                    value TEXT,
                    category VARCHAR(50) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (key, category)
                )
            `);
            
            console.log('Inicializando configuraciones predeterminadas...');
            
            // Insertar configuraciones generales predeterminadas
            await sequelize.query(`
                INSERT INTO app_settings (key, value, category, description)
                VALUES 
                    ('app_name', 'Bot de Asistencia a Eventos', 'general', 'Nombre de la aplicación'),
                    ('app_version', '1.0.0', 'general', 'Versión de la aplicación'),
                    ('timezone', 'America/Caracas', 'general', 'Zona horaria para fechas y horas')
                ON CONFLICT (key, category) DO NOTHING
            `);
            
            // Insertar configuraciones de bot predeterminadas
            await sequelize.query(`
                INSERT INTO app_settings (key, value, category, description)
                VALUES 
                    ('bot_name', 'Asistente de Eventos', 'bot', 'Nombre del bot'),
                    ('bot_username', '@eventos_bot', 'bot', 'Nombre de usuario del bot'),
                    ('bot_welcome_message', '¡Bienvenido al Bot de Eventos!', 'bot', 'Mensaje de bienvenida')
                ON CONFLICT (key, category) DO NOTHING
            `);
            
            // Insertar configuraciones de notificaciones predeterminadas
            await sequelize.query(`
                INSERT INTO app_settings (key, value, category, description)
                VALUES 
                    ('notifications_enabled', 'true', 'notifications', 'Habilitar notificaciones'),
                    ('default_hours_before', '24', 'notifications', 'Horas antes del evento para enviar recordatorio')
                ON CONFLICT (key, category) DO NOTHING
            `);
            
            console.log('Tabla app_settings creada e inicializada correctamente.');
        } else {
            console.log('La tabla app_settings ya existe.');
        }
        
        return true;
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
        return false;
    }
}

module.exports = { initializeDatabase }; 