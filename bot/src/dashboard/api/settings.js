const express = require('express');
const router = express.Router();
const { authenticateToken, checkAdminRole } = require('../middleware/auth');
const { sequelize, Participante, Organizacion, AppSettings } = require('../../database');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const multer = require('multer');
const child_process = require('child_process');
const exec = promisify(child_process.exec);
const logger = require('../../utils/logger');

// Directorio para almacenar respaldos
const BACKUPS_DIR = path.join(__dirname, '../../../backups');

// Configurar multer para la carga de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Asegurar que el directorio existe
        fs.mkdir(BACKUPS_DIR, { recursive: true }, (err) => {
            if (err) return cb(err);
            cb(null, BACKUPS_DIR);
        });
    },
    filename: function (req, file, cb) {
        cb(null, `restore_${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // Límite de 50MB
    fileFilter: function (req, file, cb) {
        // Aceptar solo archivos .sql y .zip
        if (file.originalname.match(/\.(sql|zip)$/)) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten archivos SQL o ZIP'));
    }
});

// Asegurar que los directorios existen
async function ensureDirectories() {
    try {
        await promisify(fs.mkdir)(BACKUPS_DIR, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Funciones auxiliares para el manejo de configuraciones
const getSettingsByCategory = async (category, req, res) => {
    try {
        // Comprobar si hay configuraciones en esta categoría y crearlas si no existen
        const count = await AppSettings.count({ where: { category } });
        
        if (count === 0) {
            // Inicializar configuraciones por defecto según la categoría
            if (category === 'admins') {
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
            } else if (category === 'backups') {
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
        }
        
        // Determinar si debemos filtrar por organización
        const organizationId = req.user?.organization_id || null;
        const whereClause = { category };
        
        if (organizationId) {
            // Buscar configuraciones específicas de la organización o globales (null)
            whereClause.organization_id = {
                [sequelize.Sequelize.Op.or]: [organizationId, null]
            };
        }
        
        // Obtener las configuraciones
        const settings = await AppSettings.findAll({
            where: whereClause,
            order: [['key', 'ASC']]
        });
        
        // Transformar el array a un objeto para facilitar su uso en el frontend
        const settingsObj = {};
        settings.forEach(setting => {
            // Convertir el valor según el tipo de dato
            let value = setting.value;
            
            try {
                switch (setting.data_type) {
                    case 'boolean':
                        value = value === 'true';
                        break;
                    case 'number':
                        value = parseFloat(value);
                        break;
                    case 'json':
                        value = JSON.parse(value);
                        break;
                    case 'date':
                        value = new Date(value);
                        break;
                    default:
                        // string u otros tipos
                        break;
                }
            } catch (error) {
                logger.error(`Error al convertir valor de configuración '${setting.key}':`, error);
            }
            
            settingsObj[setting.key] = {
                id: setting.id,
                value: value,
                description: setting.description,
                dataType: setting.data_type,
                isPublic: setting.is_public
            };
        });
        
        return res.json(settingsObj);
    } catch (error) {
        logger.exception(error, `Error al obtener configuraciones de '${category}'`);
        return res.status(500).json({ error: 'Error al obtener configuraciones' });
    }
};

const updateSettingsByCategory = async (category, req, res) => {
    try {
        const settings = req.body;
        const organizationId = req.user?.organization_id || null;
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
                        category,
                        organization_id: organizationId
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
                        is_public: false,
                        organization_id: organizationId
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
        logger.exception(error, `Error al actualizar configuraciones de '${category}'`);
        return res.status(500).json({ error: 'Error al actualizar configuraciones' });
    }
};

// Debug de rutas
console.log('🔍 [DEBUG SETTINGS] Registrando rutas:');
console.log('- GET /api/settings/general');
console.log('- GET /api/settings/bot');
console.log('- GET /api/settings/notifications');
console.log('- GET /api/settings/admins');
console.log('- GET /api/settings/backups');

// Endpoint para configuraciones generales
router.get('/general', async (req, res) => {
    return getSettingsByCategory('general', req, res);
});

router.post('/general', authenticateToken, checkAdminRole, async (req, res) => {
    return updateSettingsByCategory('general', req, res);
});

// Endpoint para configuraciones del bot
router.get('/bot', async (req, res) => {
    return getSettingsByCategory('bot', req, res);
});

router.post('/bot', authenticateToken, checkAdminRole, async (req, res) => {
    return updateSettingsByCategory('bot', req, res);
});

// Endpoint para configuraciones de notificaciones
router.get('/notifications', async (req, res) => {
    return getSettingsByCategory('notifications', req, res);
});

router.post('/notifications', authenticateToken, checkAdminRole, async (req, res) => {
    return updateSettingsByCategory('notifications', req, res);
});

// Endpoint para configuraciones de administradores
router.get('/admins', async (req, res) => {
    return getSettingsByCategory('admins', req, res);
});

router.post('/admins', authenticateToken, checkAdminRole, async (req, res) => {
    return updateSettingsByCategory('admins', req, res);
});

// Endpoint para configuraciones de respaldos
router.get('/backups', async (req, res) => {
    return getSettingsByCategory('backups', req, res);
});

router.post('/backups', authenticateToken, checkAdminRole, async (req, res) => {
    return updateSettingsByCategory('backups', req, res);
});

// Obtener lista de administradores (usuarios con rol admin)
router.get('/admin-users', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        // Obtener administradores (usuarios con rol 'admin')
        const query = `
            SELECT 
                p.id, 
                p.first_name, 
                p.last_name, 
                p.nac, 
                p.cedula,
                p.telegram_id, 
                p.email, 
                p.phone,
                p.created_at,
                p.updated_at
            FROM participants p
            WHERE p.user_role = 'admin'
            ORDER BY p.last_name, p.first_name
        `;
        
        const [admins] = await sequelize.query(query);
        
        res.json(admins);
    } catch (error) {
        console.error('Error al obtener lista de administradores:', error);
        res.status(500).json({ error: 'Error al obtener lista de administradores' });
    }
});

// Obtener un administrador específico
router.get('/admins/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const adminId = req.params.id;
        
        // Obtener administrador
        const admin = await Participante.findOne({
            where: { 
                id: adminId,
                rol: 'admin'
            },
            include: [{
                model: Organizacion,
                attributes: ['id', 'name']
            }],
            order: [['firstName', 'ASC'], ['lastName', 'ASC']]
        });
        
        if (!admin) {
            return res.status(404).json({ error: 'Administrador no encontrado' });
        }
        
        // Transformar datos para el cliente
        const adminData = {
            id: admin.id,
            name: `${admin.firstName} ${admin.lastName}`.trim(),
            telegramId: admin.telegramId || 'N/A',
            type: admin.rol === 'admin' ? 'admin' : 'operator', // Simplificado para el ejemplo
            email: admin.email,
            organizationId: admin.organization_id,
            organizationName: admin.Organizacion ? admin.Organizacion.name : null,
            active: true // Asumimos que está activo para este ejemplo
        };
        
        res.json(adminData);
    } catch (error) {
        console.error('Error al obtener administrador:', error);
        res.status(500).json({ error: 'Error al obtener administrador' });
    }
});

// Crear un nuevo administrador
router.post('/admins', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { name, telegramId, type, email, organizationId, active } = req.body;
        
        // Validar datos
        if (!name) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        
        if (!telegramId) {
            return res.status(400).json({ error: 'El ID de Telegram es obligatorio' });
        }
        
        // Verificar si ya existe un participante con este ID de Telegram
        const existingUser = await Participante.findOne({
            where: { telegramId }
        });
        
        if (existingUser) {
            // Si ya existe, actualizar a rol de administrador
            existingUser.rol = type === 'super' ? 'super_admin' : (type === 'admin' ? 'admin' : 'operator');
            existingUser.email = email || existingUser.email;
            existingUser.organization_id = type === 'operator' ? organizationId : null;
            existingUser.updatedAt = new Date();
            
            await existingUser.save();
            
            // Devolver datos actualizados
            return res.json({
                id: existingUser.id,
                name: `${existingUser.firstName} ${existingUser.lastName}`.trim(),
                telegramId: existingUser.telegramId,
                type: existingUser.rol,
                email: existingUser.email,
                organizationId: existingUser.organization_id,
                active: true,
                updated: true
            });
        }
        
        // Extraer nombre y apellido de 'name'
        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        // Crear nuevo participante con rol de administrador
        const newAdmin = await Participante.create({
            nac: 'V', // Valor por defecto
            cedula: '0', // Valor temporal
            firstName,
            lastName,
            telegramId,
            email,
            organization_id: type === 'operator' ? organizationId : null,
            rol: type === 'super' ? 'super_admin' : (type === 'admin' ? 'admin' : 'operator'),
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        // Devolver datos del nuevo administrador
        res.status(201).json({
            id: newAdmin.id,
            name: `${newAdmin.firstName} ${newAdmin.lastName}`.trim(),
            telegramId: newAdmin.telegramId,
            type: newAdmin.rol,
            email: newAdmin.email,
            organizationId: newAdmin.organization_id,
            active: true,
            created: true
        });
    } catch (error) {
        console.error('Error al crear administrador:', error);
        res.status(500).json({ error: 'Error al crear administrador', detail: error.message });
    }
});

// Actualizar un administrador
router.put('/admins/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const adminId = req.params.id;
        const { name, telegramId, type, email, organizationId, active } = req.body;
        
        // Validar datos
        if (!name) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        
        if (!telegramId) {
            return res.status(400).json({ error: 'El ID de Telegram es obligatorio' });
        }
        
        // Verificar que el administrador existe
        const admin = await Participante.findOne({
            where: { 
                id: adminId,
                rol: ['admin', 'super_admin', 'operator']
            }
        });
        
        if (!admin) {
            return res.status(404).json({ error: 'Administrador no encontrado' });
        }
        
        // Verificar telegramId único (excepto para el mismo usuario)
        if (telegramId !== admin.telegramId) {
            const existingTelegramId = await Participante.findOne({
                where: {
                    telegramId,
                    id: { [sequelize.Sequelize.Op.ne]: adminId }
                }
            });
            
            if (existingTelegramId) {
                return res.status(400).json({ error: 'El ID de Telegram ya está en uso por otro usuario' });
            }
        }
        
        // Extraer nombre y apellido de 'name'
        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        // Actualizar datos
        admin.firstName = firstName;
        admin.lastName = lastName;
        admin.telegramId = telegramId;
        admin.email = email;
        admin.organization_id = type === 'operator' ? organizationId : null;
        admin.rol = type === 'super' ? 'super_admin' : (type === 'admin' ? 'admin' : 'operator');
        admin.updatedAt = new Date();
        
        await admin.save();
        
        // Devolver datos actualizados
        res.json({
            id: admin.id,
            name: `${admin.firstName} ${admin.lastName}`.trim(),
            telegramId: admin.telegramId,
            type: admin.rol,
            email: admin.email,
            organizationId: admin.organization_id,
            active: true,
            updated: true
        });
    } catch (error) {
        console.error('Error al actualizar administrador:', error);
        res.status(500).json({ error: 'Error al actualizar administrador' });
    }
});

// Eliminar un administrador
router.delete('/admins/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const adminId = req.params.id;
        
        // Verificar que el administrador existe
        const admin = await Participante.findOne({
            where: { 
                id: adminId,
                rol: ['admin', 'super_admin', 'operator']
            }
        });
        
        if (!admin) {
            return res.status(404).json({ error: 'Administrador no encontrado' });
        }
        
        // Prevenir eliminación de superadministradores
        if (admin.rol === 'super_admin') {
            return res.status(403).json({ error: 'No se puede eliminar un superadministrador' });
        }
        
        // En lugar de eliminar, cambiar rol a usuario normal
        admin.rol = 'user';
        admin.updatedAt = new Date();
        
        await admin.save();
        
        res.json({
            id: adminId,
            message: 'Administrador eliminado correctamente',
            deleted: true
        });
    } catch (error) {
        console.error('Error al eliminar administrador:', error);
        res.status(500).json({ error: 'Error al eliminar administrador' });
    }
});

// Obtener lista de respaldos
router.get('/backups', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        // En una implementación real, consultaríamos los respaldos disponibles
        // Aquí simulamos respaldos para la interfaz
        const mockBackups = [
            {
                id: 'backup-20230501',
                name: 'Respaldo automático 01-05-2023',
                date: '2023-05-01T04:00:00Z',
                size: '2.5 MB',
                type: 'automatic'
            },
            {
                id: 'backup-20230601',
                name: 'Respaldo automático 01-06-2023',
                date: '2023-06-01T04:00:00Z',
                size: '2.7 MB',
                type: 'automatic'
            },
            {
                id: 'backup-20230615',
                name: 'Respaldo manual 15-06-2023',
                date: '2023-06-15T15:30:00Z',
                size: '2.8 MB',
                type: 'manual'
            }
        ];
        
        res.json(mockBackups);
    } catch (error) {
        console.error('Error al obtener respaldos:', error);
        res.status(500).json({ error: 'Error al obtener respaldos' });
    }
});

// Crear un nuevo respaldo
router.post('/backups', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { includeAttachments } = req.body;
        
        // Asegurar que el directorio existe
        await ensureDirectories();
        
        // En una aplicación real, aquí se utilizaría una herramienta como pg_dump
        // para PostgreSQL o mysqldump para MySQL para crear el respaldo
        
        // Nombre del archivo de respaldo
        const timestamp = Date.now();
        const username = req.user.username || 'admin';
        const filename = `backup_${timestamp}_${username}.sql`;
        const filePath = path.join(BACKUPS_DIR, filename);
        
        // Para este ejemplo, simulamos un respaldo creando un archivo simple
        const content = `-- Respaldo generado: ${new Date().toISOString()}
-- Usuario: ${username}
-- Incluye adjuntos: ${includeAttachments ? 'Sí' : 'No'}

-- Este es un archivo de respaldo simulado para fines de demostración.
-- En una aplicación real, aquí estaría el SQL completo para restaurar la base de datos.
`;
        
        await promisify(fs.writeFile)(filePath, content);
        
        // Si se solicita incluir adjuntos, simular un archivo ZIP
        let zipFilePath = null;
        if (includeAttachments) {
            // En una aplicación real, aquí se comprimirían la base de datos y los archivos adjuntos
            // Simulamos el proceso con un archivo adicional
            zipFilePath = path.join(BACKUPS_DIR, `backup_${timestamp}_${username}_with_attachments.zip`);
            await promisify(fs.writeFile)(zipFilePath, 'Archivo ZIP simulado');
            
            // Devolver información del archivo ZIP
            res.json({
                id: path.basename(zipFilePath),
                filename: path.basename(zipFilePath),
                createdAt: new Date(),
                size: (await promisify(fs.stat)(zipFilePath)).size,
                type: 'ZIP',
                createdBy: username,
                downloadUrl: `/api/settings/backups/${path.basename(zipFilePath)}/download`
            });
            return;
        }
        
        // Devolver información del archivo
        res.json({
            id: filename,
            filename,
            createdAt: new Date(),
            size: (await promisify(fs.stat)(filePath)).size,
            type: 'SQL',
            createdBy: username,
            downloadUrl: `/api/settings/backups/${filename}/download`
        });
    } catch (error) {
        console.error('Error al crear respaldo:', error);
        res.status(500).json({ error: 'Error al crear respaldo' });
    }
});

// Descargar un respaldo
router.get('/backups/:filename/download', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(BACKUPS_DIR, filename);
        
        // Verificar que el archivo existe
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo de respaldo no encontrado' });
        }
        
        // Enviar archivo
        res.download(filePath, filename);
    } catch (error) {
        console.error('Error al descargar respaldo:', error);
        res.status(500).json({ error: 'Error al descargar respaldo' });
    }
});

// Eliminar un respaldo
router.delete('/backups/:filename', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(BACKUPS_DIR, filename);
        
        // Verificar que el archivo existe
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo de respaldo no encontrado' });
        }
        
        // Eliminar archivo
        await promisify(fs.unlink)(filePath);
        
        res.json({
            id: filename,
            message: 'Respaldo eliminado correctamente',
            deleted: true
        });
    } catch (error) {
        console.error('Error al eliminar respaldo:', error);
        res.status(500).json({ error: 'Error al eliminar respaldo' });
    }
});

// Restaurar sistema desde un respaldo
router.post('/backups/restore', authenticateToken, checkAdminRole, upload.single('backupFile'), async (req, res) => {
    try {
        // Verificar que se subió un archivo
        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó un archivo de respaldo' });
        }
        
        const filePath = req.file.path;
        
        // En una aplicación real, aquí se restauraría la base de datos
        // utilizando herramientas como psql o mysql
        
        // Simulamos una restauración exitosa
        res.json({
            message: 'Sistema restaurado correctamente',
            restored: true,
            filename: req.file.originalname
        });
        
        // Eliminar archivo temporal después de la respuesta
        setTimeout(() => {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error al eliminar archivo temporal:', err);
            });
        }, 1000);
    } catch (error) {
        console.error('Error al restaurar sistema:', error);
        res.status(500).json({ error: 'Error al restaurar sistema', detail: error.message });
    }
});

// Inicializar configuraciones por defecto
const initializeDefaultSettings = async () => {
    try {
        // Verificar si ya existen configuraciones
        const count = await AppSettings.count();
        if (count > 0) {
            logger.info('Las configuraciones ya están inicializadas');
            return;
        }
        
        // Configuraciones generales
        const generalSettings = [
            { key: 'app_name', value: 'Sistema de Notificación de Eventos', category: 'general', description: 'Nombre de la aplicación', data_type: 'string', is_public: true },
            { key: 'app_description', value: 'Sistema para gestionar eventos y asistencias', category: 'general', description: 'Descripción de la aplicación', data_type: 'string', is_public: true },
            { key: 'app_logo_url', value: '', category: 'general', description: 'URL del logo de la aplicación', data_type: 'string', is_public: true },
            { key: 'primary_color', value: '#3498db', category: 'general', description: 'Color primario de la aplicación', data_type: 'string', is_public: true },
            { key: 'secondary_color', value: '#2ecc71', category: 'general', description: 'Color secundario de la aplicación', data_type: 'string', is_public: true }
        ];
        
        // Configuraciones del bot
        const botSettings = [
            { key: 'bot_welcome_message', value: '¡Bienvenido al Bot de Notificaciones! 👋', category: 'bot', description: 'Mensaje de bienvenida del bot', data_type: 'string', is_public: false },
            { key: 'bot_help_message', value: 'Puedes usar este bot para registrar tu asistencia a eventos y recibir notificaciones importantes.', category: 'bot', description: 'Mensaje de ayuda del bot', data_type: 'string', is_public: false },
            { key: 'bot_enable_location', value: 'true', category: 'bot', description: 'Habilitar solicitud de ubicación para asistencias', data_type: 'boolean', is_public: false }
        ];
        
        // Configuraciones de notificaciones
        const notificationSettings = [
            { key: 'notification_before_hours', value: '24', category: 'notifications', description: 'Horas antes del evento para enviar notificaciones', data_type: 'number', is_public: false },
            { key: 'notification_reminder_template', value: 'Recordatorio: El evento {{event_name}} está programado para mañana a las {{event_time}}. ¡Te esperamos!', category: 'notifications', description: 'Plantilla para recordatorios de eventos', data_type: 'string', is_public: false },
            { key: 'notification_enable_reminders', value: 'true', category: 'notifications', description: 'Habilitar recordatorios automáticos', data_type: 'boolean', is_public: false }
        ];
        
        // Configuraciones de administradores
        const adminSettings = [
            { key: 'admin_require_2fa', value: 'false', category: 'admins', description: 'Requerir autenticación de dos factores para administradores', data_type: 'boolean', is_public: false },
            { key: 'admin_session_timeout', value: '60', category: 'admins', description: 'Tiempo de inactividad antes de cerrar sesión (minutos)', data_type: 'number', is_public: false }
        ];
        
        // Configuraciones de respaldos
        const backupSettings = [
            { key: 'backup_auto_enabled', value: 'true', category: 'backups', description: 'Habilitar respaldos automáticos', data_type: 'boolean', is_public: false },
            { key: 'backup_frequency', value: 'daily', category: 'backups', description: 'Frecuencia de respaldos (daily, weekly, monthly)', data_type: 'string', is_public: false },
            { key: 'backup_retention_days', value: '30', category: 'backups', description: 'Días que se conservan los respaldos', data_type: 'number', is_public: false }
        ];
        
        // Combinar todas las configuraciones
        const allSettings = [
            ...generalSettings, 
            ...botSettings, 
            ...notificationSettings, 
            ...adminSettings, 
            ...backupSettings
        ];
        
        // Crear todas las configuraciones
        await AppSettings.bulkCreate(allSettings);
        
        logger.info('Configuraciones por defecto inicializadas correctamente');
    } catch (error) {
        logger.exception(error, 'Error al inicializar configuraciones por defecto');
    }
};

// Inicializar configuraciones por defecto al cargar el módulo
initializeDefaultSettings();

module.exports = router; 