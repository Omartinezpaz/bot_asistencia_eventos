// Cargar variables de entorno desde .env
require('dotenv').config();

const { sequelize, AppSettings } = require('../database');

async function crearCategoriasAdicionales() {
  try {
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL || 'No definido'}`);
    
    // Configuraciones de administradores
    console.log('Creando configuraciones de administradores...');
    // Verificar si existen configuraciones para admins
    const countAdmins = await AppSettings.count({ where: { category: 'admins' } });
    
    // Si no existen, crear algunas configuraciones por defecto
    if (countAdmins === 0) {
      await AppSettings.bulkCreate([
        {
          key: 'allow_register',
          value: 'true',
          category: 'admins',
          description: 'Permitir registro de nuevos administradores',
          data_type: 'boolean',
          is_public: false
        },
        {
          key: 'admin_approval',
          value: 'true',
          category: 'admins',
          description: 'Requerir aprobación de administrador existente',
          data_type: 'boolean',
          is_public: false
        },
        {
          key: 'session_timeout',
          value: '60',
          category: 'admins',
          description: 'Tiempo de expiración de sesión en minutos',
          data_type: 'number',
          is_public: false
        }
      ]);
      console.log('Configuraciones de administradores creadas correctamente.');
    } else {
      console.log('Las configuraciones de administradores ya existen.');
    }
    
    // Configuraciones de respaldos
    console.log('Creando configuraciones de respaldos...');
    // Verificar si existen configuraciones para backups
    const countBackups = await AppSettings.count({ where: { category: 'backups' } });
    
    // Si no existen, crear algunas configuraciones por defecto
    if (countBackups === 0) {
      await AppSettings.bulkCreate([
        {
          key: 'backup_enabled',
          value: 'true',
          category: 'backups',
          description: 'Habilitar respaldos automáticos',
          data_type: 'boolean',
          is_public: false
        },
        {
          key: 'backup_frequency',
          value: '7',
          category: 'backups',
          description: 'Frecuencia de respaldos en días',
          data_type: 'number',
          is_public: false
        },
        {
          key: 'backup_retention',
          value: '30',
          category: 'backups',
          description: 'Días de retención de respaldos',
          data_type: 'number',
          is_public: false
        }
      ]);
      console.log('Configuraciones de respaldos creadas correctamente.');
    } else {
      console.log('Las configuraciones de respaldos ya existen.');
    }
    
    // Listar todas las configuraciones
    console.log('Listando todas las configuraciones existentes:');
    const allSettings = await AppSettings.findAll({
      order: [['category', 'ASC'], ['key', 'ASC']]
    });
    
    allSettings.forEach(setting => {
      console.log(`${setting.category}.${setting.key} = ${setting.value} (${setting.data_type})`);
    });
    
  } catch (error) {
    console.error('Error al crear categorías adicionales:', error);
  } finally {
    // Cerrar la conexión
    await sequelize.close();
  }
}

// Ejecutar la función principal
crearCategoriasAdicionales(); 