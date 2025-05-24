require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { setupDatabase } = require('./database');
const { setupRoutes } = require('./routes');
const { startBot } = require('./bot');
const logger = require('./utils/logger');

// Inicializar aplicación Express
const app = express();
const PORT = process.env.PORT || 3006;

// Middlewares
app.use(cors({
  origin: '*', // Permitir todos los orígenes
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/admin', express.static(path.join(__dirname, 'dashboard/admin')));

// Agregar endpoint de prueba directamente
app.get('/api-test', (req, res) => {
  res.json({ message: 'API funcionando correctamente desde index.js' });
});

// Endpoints de configuraciones directamente
app.get('/api/settings/general', async (req, res) => {
  try {
    const { AppSettings } = require('./database');
    const settings = await AppSettings.findAll({
      where: { category: 'general' },
      order: [['key', 'ASC']]
    });
    
    // Transformar a objeto
    const result = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        if (setting.data_type === 'boolean') {
          value = value === 'true';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        } else if (setting.data_type === 'json') {
          value = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Error al convertir valor de ${setting.key}:`, error);
      }
      
      result[setting.key] = value;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error al obtener configuraciones generales:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones generales' });
  }
});

app.get('/api/settings/bot', async (req, res) => {
  try {
    const { AppSettings } = require('./database');
    const settings = await AppSettings.findAll({
      where: { category: 'bot' },
      order: [['key', 'ASC']]
    });
    
    // Transformar a objeto
    const result = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        if (setting.data_type === 'boolean') {
          value = value === 'true';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        } else if (setting.data_type === 'json') {
          value = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Error al convertir valor de ${setting.key}:`, error);
      }
      
      result[setting.key] = value;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error al obtener configuraciones del bot:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones del bot' });
  }
});

app.get('/api/settings/notifications', async (req, res) => {
  try {
    const { AppSettings } = require('./database');
    const settings = await AppSettings.findAll({
      where: { category: 'notifications' },
      order: [['key', 'ASC']]
    });
    
    // Transformar a objeto
    const result = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        if (setting.data_type === 'boolean') {
          value = value === 'true';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        } else if (setting.data_type === 'json') {
          value = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Error al convertir valor de ${setting.key}:`, error);
      }
      
      result[setting.key] = value;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error al obtener configuraciones de notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones de notificaciones' });
  }
});

// Configuraciones de administradores
app.get('/api/settings/admins', async (req, res) => {
  try {
    const { AppSettings } = require('./database');
    
    const settings = await AppSettings.findAll({
      where: { category: 'admins' },
      order: [['key', 'ASC']]
    });
    
    // Transformar a objeto
    const result = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        if (setting.data_type === 'boolean') {
          value = value === 'true';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        } else if (setting.data_type === 'json') {
          value = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Error al convertir valor de ${setting.key}:`, error);
      }
      
      result[setting.key] = value;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error al obtener configuraciones de administradores:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones de administradores' });
  }
});

// Configuraciones de respaldos
app.get('/api/settings/backups', async (req, res) => {
  try {
    const { AppSettings } = require('./database');
    
    const settings = await AppSettings.findAll({
      where: { category: 'backups' },
      order: [['key', 'ASC']]
    });
    
    // Transformar a objeto
    const result = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        if (setting.data_type === 'boolean') {
          value = value === 'true';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        } else if (setting.data_type === 'json') {
          value = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Error al convertir valor de ${setting.key}:`, error);
      }
      
      result[setting.key] = value;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error al obtener configuraciones de respaldos:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones de respaldos' });
  }
});

// Función auxiliar para actualizar configuraciones
const updateSettingsByCategory = async (category, req, res) => {
  try {
    const { AppSettings } = require('./database');
    const settings = req.body;
    const results = [];
    
    // Iterar sobre cada configuración recibida
    for (const key in settings) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        let value = settings[key];
        let dataType = typeof value;
        
        // Convertir el valor a string para almacenamiento
        if (value === null || value === undefined) {
          value = null;
        } else if (typeof value === 'object') {
          value = JSON.stringify(value);
          dataType = 'json';
        } else if (typeof value === 'boolean') {
          value = value.toString();
          dataType = 'boolean';
        } else if (typeof value === 'number') {
          value = value.toString();
          dataType = 'number';
        } else {
          value = value.toString();
          dataType = 'string';
        }
        
        // Buscar si la configuración ya existe
        let setting = await AppSettings.findOne({
          where: {
            key,
            category
          }
        });
        
        if (setting) {
          // Actualizar configuración existente
          setting.value = value;
          await setting.save();
          results.push({ key, action: 'updated', id: setting.id });
        } else {
          // Crear nueva configuración
          setting = await AppSettings.create({
            key,
            value,
            category,
            data_type: dataType,
            is_public: false
          });
          results.push({ key, action: 'created', id: setting.id });
        }
      }
    }
    
    return res.json({
      success: true,
      message: `Configuraciones de ${category} actualizadas correctamente`,
      results
    });
  } catch (error) {
    console.error(`Error al actualizar configuraciones de ${category}:`, error);
    return res.status(500).json({ error: `Error al actualizar configuraciones de ${category}` });
  }
};

// Endpoint para configuraciones generales (POST)
app.post('/api/settings/general', async (req, res) => {
  return updateSettingsByCategory('general', req, res);
});

// Endpoint para configuraciones del bot (POST)
app.post('/api/settings/bot', async (req, res) => {
  return updateSettingsByCategory('bot', req, res);
});

// Endpoint para configuraciones de notificaciones (POST)
app.post('/api/settings/notifications', async (req, res) => {
  return updateSettingsByCategory('notifications', req, res);
});

// Endpoint para configuraciones de administradores (POST)
app.post('/api/settings/admins', async (req, res) => {
  return updateSettingsByCategory('admins', req, res);
});

// Endpoint para configuraciones de respaldos (POST)
app.post('/api/settings/backups', async (req, res) => {
  return updateSettingsByCategory('backups', req, res);
});

// Agregar endpoint de configuraciones directamente
app.get('/api/settings-test', (req, res) => {
  res.json({ 
    message: 'Endpoint de configuraciones funcionando',
    time: new Date().toISOString()
  });
});

// Middleware para registro de solicitudes HTTP
app.use((req, res, next) => {
  const start = Date.now();
  
  // Cuando la respuesta termine, registramos los detalles
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(req, res, `Completado en ${duration}ms`);
  });
  
  next();
});

// Conectar a la base de datos
setupDatabase();

// Iniciar el bot y el servidor web
startBot().catch(err => {
  logger.exception(err, 'Error al iniciar el bot');
});

// Configurar rutas de la API
setupRoutes(app);

// Middleware para capturar rutas no existentes (404)
app.use((req, res, next) => {
  logger.error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Middleware para manejo de errores detallado
app.use((err, req, res, next) => {
  logger.exception(err, `Error en la solicitud a ${req.path}`);
  logger.error('Ruta:', req.path);
  logger.error('Método HTTP:', req.method);
  logger.error('Cuerpo de la solicitud:', req.body);
  logger.error('Parámetros de consulta:', req.query);
  
  res.status(500).json({
    error: err.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    errorType: err.name,
    errorCode: err.code
  });
});

// Endpoints para pruebas directas
app.get('/api-test/admins', async (req, res) => {
  try {
    const { AppSettings } = require('./database');
    
    // Verificar si existen configuraciones para admins
    const count = await AppSettings.count({ where: { category: 'admins' } });
    
    // Si no existen, crear algunas configuraciones por defecto
    if (count === 0) {
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
    }
    
    const settings = await AppSettings.findAll({
      where: { category: 'admins' },
      order: [['key', 'ASC']]
    });
    
    // Transformar a objeto
    const result = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        if (setting.data_type === 'boolean') {
          value = value === 'true';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        } else if (setting.data_type === 'json') {
          value = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Error al convertir valor de ${setting.key}:`, error);
      }
      
      result[setting.key] = value;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error al obtener configuraciones de administradores:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones de administradores' });
  }
});

app.get('/api-test/backups', async (req, res) => {
  try {
    const { AppSettings } = require('./database');
    
    // Verificar si existen configuraciones para backups
    const count = await AppSettings.count({ where: { category: 'backups' } });
    
    // Si no existen, crear algunas configuraciones por defecto
    if (count === 0) {
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
    }
    
    const settings = await AppSettings.findAll({
      where: { category: 'backups' },
      order: [['key', 'ASC']]
    });
    
    // Transformar a objeto
    const result = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        if (setting.data_type === 'boolean') {
          value = value === 'true';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        } else if (setting.data_type === 'json') {
          value = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Error al convertir valor de ${setting.key}:`, error);
      }
      
      result[setting.key] = value;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error al obtener configuraciones de respaldos:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones de respaldos' });
  }
});

// Endpoint para obtener todas las configuraciones
app.get('/api/settings/all', async (req, res) => {
  console.log('🔍 [DEBUG] Recibida solicitud a /api/settings/all');
  
  try {
    const { AppSettings } = require('./database');
    
    const settings = await AppSettings.findAll({
      order: [['category', 'ASC'], ['key', 'ASC']]
    });
    
    console.log(`🔍 [DEBUG] Encontradas ${settings.length} configuraciones`);
    
    // Transformar a objeto agrupado por categoría
    const result = {};
    settings.forEach(setting => {
      let value = setting.value;
      try {
        if (setting.data_type === 'boolean') {
          value = value === 'true';
        } else if (setting.data_type === 'number') {
          value = parseFloat(value);
        } else if (setting.data_type === 'json') {
          value = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Error al convertir valor de ${setting.key}:`, error);
      }
      
      // Crear la categoría si no existe
      if (!result[setting.category]) {
        result[setting.category] = {};
      }
      
      // Agregar la configuración a la categoría
      result[setting.category][setting.key] = value;
    });
    
    console.log('🔍 [DEBUG] Enviando respuesta para /api/settings/all');
    res.json(result);
  } catch (error) {
    console.error('Error al obtener todas las configuraciones:', error);
    res.status(500).json({ error: 'Error al obtener todas las configuraciones' });
  }
});

// Iniciar el servidor web si no estamos en producción
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Servidor iniciado en http://localhost:${PORT}`);
    logger.info(`Modo: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Panel de administración disponible en: http://localhost:${PORT}/admin`);
    
    // Imprimir todas las rutas registradas
    console.log('🔍 [DEBUG] Rutas registradas:');
    app._router.stack.forEach(function(r){
      if (r.route && r.route.path){
        console.log(`${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
      }
    });
  });
} 