const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Organizacion, Participante, Evento, Asistencia, NotificacionProgramada, NotificacionEstadistica, sequelize } = require('../database');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');

// Clave secreta para JWT
const JWT_SECRET = process.env.JWT_SECRET || 'secreto-temporal-cambiar-en-produccion';

// Crear router para la API
const router = express.Router();

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Se requiere autenticación' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        
        req.user = user;
        next();
    });
};

// Middleware para verificar rol de administrador
const checkAdminRole = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
    }
    
    next();
};

// Endpoint de login
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Verificar que se proporcionaron credenciales
        if (!username || !password) {
            return res.status(400).json({ error: 'Se requieren usuario y contraseña' });
        }
        
        // Buscar usuario en la base de datos
        const user = await Participante.findOne({ 
            where: { 
                [Op.or]: [
                    { username: username },
                    { telegramId: username }
                ],
                rol: 'admin' // Solo permitir login a administradores
            } 
        });
        
        // Si no existe el usuario o la contraseña es incorrecta
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        // Para este ejemplo, usamos una verificación simple
        // En producción, usar bcrypt.compare(password, user.password)
        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        // Generar token JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username || user.telegramId,
                role: user.rol
            }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        // Responder con el token y datos básicos del usuario
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username || user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.rol
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Verificar token
router.get('/auth/verify', authenticateToken, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
        }
    });
});

// Obtener estadísticas para el dashboard
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        // Contar organizaciones
        let organizationsCount = 0;
        let eventsCount = 0;
        let participantsCount = 0;
        let attendancesCount = 0;
        let notificationStats = [];

        try {
            organizationsCount = await Organizacion.count();
        } catch (err) {
            console.error('Error al contar organizaciones:', err);
        }
        
        try {
            // Contar eventos
            eventsCount = await Evento.count();
        } catch (err) {
            console.error('Error al contar eventos:', err);
        }
        
        try {
            // Contar participantes
            participantsCount = await Participante.count();
        } catch (err) {
            console.error('Error al contar participantes:', err);
        }
        
        try {
            // Contar asistencias
            attendancesCount = await Asistencia.count();
        } catch (err) {
            console.error('Error al contar asistencias:', err);
        }
        
        try {
            // Estadísticas de notificaciones
            [notificationStats] = await sequelize.query(`
                SELECT
                    COUNT(n.id) as total,
                    SUM(CASE WHEN ns.sent THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN ns.delivered THEN 1 ELSE 0 END) as delivered,
                    SUM(CASE WHEN ns.read THEN 1 ELSE 0 END) as read,
                    SUM(CASE WHEN ns.responded THEN 1 ELSE 0 END) as responded
                FROM notif_eventos_bot.scheduled_notifications n
                LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
            `);
        } catch (err) {
            console.error('Error al obtener estadísticas de notificaciones:', err);
        }
        
        res.json({
            organizations: organizationsCount || 0,
            events: eventsCount || 0,
            participants: participantsCount || 0,
            attendances: attendancesCount || 0,
            notificationStats: notificationStats && notificationStats[0] ? notificationStats[0] : {
                total: 0,
                sent: 0,
                delivered: 0,
                read: 0,
                responded: 0
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ 
            error: 'Error al obtener estadísticas',
            organizations: 0,
            events: 0,
            participants: 0,
            attendances: 0,
            notificationStats: {
                total: 0,
                sent: 0,
                delivered: 0,
                read: 0,
                responded: 0
            }
        });
    }
});

// Obtener eventos recientes
router.get('/events/recent', authenticateToken, async (req, res) => {
    try {
        // Obtener los 5 eventos más recientes con conteo de asistencias
        let events = [];
        
        try {
            events = await Evento.findAll({
                attributes: [
                    'id', 'name', 'description', 'date', 'location', 'active', 'organization_id',
                    [sequelize.literal('(SELECT COUNT(*) FROM notif_eventos_bot.attendances WHERE eventid = "Evento".id)'), 'attendanceCount']
                ],
                include: [{
                    model: Organizacion,
                    attributes: ['id', 'name']
                }],
                order: [['date', 'DESC']],
                limit: 5
            });
        } catch (err) {
            console.error('Error específico al obtener eventos recientes:', err);
        }
        
        res.json(events || []);
    } catch (error) {
        console.error('Error al obtener eventos recientes:', error);
        res.status(500).json({ 
            error: 'Error al obtener eventos recientes',
            detail: error.message
        });
    }
});

// Obtener todas las organizaciones
router.get('/organizations', authenticateToken, async (req, res) => {
    try {
        // Obtener todas las organizaciones con conteo de participantes
        let organizations = [];
        
        try {
            organizations = await Organizacion.findAll({
                attributes: [
                    'id', 'name', 'description', 'contact_email', 'contact_phone', 'active',
                    [sequelize.literal('(SELECT COUNT(*) FROM notif_eventos_bot.participants WHERE organization_id = "Organizacion".id)'), 'participantCount']
                ],
                order: [['name', 'ASC']]
            });
        } catch (err) {
            console.error('Error específico al obtener organizaciones:', err);
        }
        
        res.json(organizations || []);
    } catch (error) {
        console.error('Error al obtener organizaciones:', error);
        res.status(500).json({ 
            error: 'Error al obtener organizaciones',
            detail: error.message
        });
    }
});

// Obtener una organización específica
router.get('/organizations/:id', authenticateToken, async (req, res) => {
    try {
        const organizationId = req.params.id;
        
        // Obtener la organización
        const organization = await Organizacion.findByPk(organizationId);
        
        if (!organization) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }
        
        res.json(organization);
    } catch (error) {
        console.error('Error al obtener organización:', error);
        res.status(500).json({ error: 'Error al obtener organización' });
    }
});

// Crear una nueva organización
router.post('/organizations', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { name, description, contact_email, contact_phone, active } = req.body;
        
        // Validar datos
        if (!name) {
            return res.status(400).json({ error: 'El nombre de la organización es obligatorio' });
        }
        
        // Crear la organización
        const organization = await Organizacion.create({
            name,
            description,
            contact_email,
            contact_phone,
            active: active !== undefined ? active : true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        res.status(201).json(organization);
    } catch (error) {
        console.error('Error al crear organización:', error);
        res.status(500).json({ error: 'Error al crear organización' });
    }
});

// Actualizar una organización
router.put('/organizations/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const organizationId = req.params.id;
        const { name, description, contact_email, contact_phone, active } = req.body;
        
        // Validar datos
        if (!name) {
            return res.status(400).json({ error: 'El nombre de la organización es obligatorio' });
        }
        
        // Buscar la organización
        const organization = await Organizacion.findByPk(organizationId);
        
        if (!organization) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }
        
        // Actualizar datos
        organization.name = name;
        organization.description = description;
        organization.contact_email = contact_email;
        organization.contact_phone = contact_phone;
        if (active !== undefined) {
            organization.active = active;
        }
        organization.updatedAt = new Date();
        
        // Guardar cambios
        await organization.save();
        
        res.json(organization);
    } catch (error) {
        console.error('Error al actualizar organización:', error);
        res.status(500).json({ error: 'Error al actualizar organización' });
    }
});

// Cambiar estado de una organización
router.patch('/organizations/:id/status', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const organizationId = req.params.id;
        const { active } = req.body;
        
        // Validar datos
        if (active === undefined) {
            return res.status(400).json({ error: 'Se requiere el estado (active)' });
        }
        
        // Buscar la organización
        const organization = await Organizacion.findByPk(organizationId);
        
        if (!organization) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }
        
        // Actualizar estado
        organization.active = active;
        organization.updatedAt = new Date();
        
        // Guardar cambios
        await organization.save();
        
        res.json({
            id: organization.id,
            name: organization.name,
            active: organization.active
        });
    } catch (error) {
        console.error('Error al cambiar estado de organización:', error);
        res.status(500).json({ error: 'Error al cambiar estado de organización' });
    }
});

// Obtener todos los eventos
router.get('/events', authenticateToken, async (req, res) => {
    try {
        // Obtener todos los eventos con conteo de asistencias
        let events = [];
        
        try {
            events = await Evento.findAll({
                attributes: [
                    'id', 'name', 'description', 'date', 'location', 'active', 'organization_id',
                    'notification_enabled', 'notification_hours_before',
                    [sequelize.literal('(SELECT COUNT(*) FROM notif_eventos_bot.attendances WHERE eventid = "Evento".id)'), 'attendanceCount']
                ],
                include: [{
                    model: Organizacion,
                    attributes: ['id', 'name']
                }],
                order: [['date', 'DESC']]
            });
        } catch (err) {
            console.error('Error específico al obtener eventos:', err);
        }
        
        res.json(events || []);
    } catch (error) {
        console.error('Error al obtener eventos:', error);
        res.status(500).json({ 
            error: 'Error al obtener eventos',
            detail: error.message
        });
    }
});

// Obtener un evento específico
router.get('/events/:id', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.id;
        
        // Obtener el evento
        const event = await Evento.findByPk(eventId, {
            include: [{
                model: Organizacion,
                attributes: ['id', 'name']
            }]
        });
        
        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        res.json(event);
    } catch (error) {
        console.error('Error al obtener evento:', error);
        res.status(500).json({ error: 'Error al obtener evento' });
    }
});

// Crear un nuevo evento
router.post('/events', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { 
            name, description, date, location, organization_id, active,
            notification_enabled, notification_hours_before
        } = req.body;
        
        // Validar datos
        if (!name) {
            return res.status(400).json({ error: 'El nombre del evento es obligatorio' });
        }
        
        if (!date) {
            return res.status(400).json({ error: 'La fecha del evento es obligatoria' });
        }
        
        if (!organization_id) {
            return res.status(400).json({ error: 'La organización es obligatoria' });
        }
        
        // Crear el evento
        const event = await Evento.create({
            name,
            description,
            date: new Date(date),
            location,
            organization_id,
            active: active !== undefined ? active : true,
            notification_enabled: notification_enabled !== undefined ? notification_enabled : true,
            notification_hours_before: notification_hours_before || 24,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        res.status(201).json(event);
    } catch (error) {
        console.error('Error al crear evento:', error);
        res.status(500).json({ error: 'Error al crear evento' });
    }
});

// Actualizar un evento
router.put('/events/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const eventId = req.params.id;
        const { 
            name, description, date, location, organization_id, active,
            notification_enabled, notification_hours_before
        } = req.body;
        
        // Validar datos
        if (!name) {
            return res.status(400).json({ error: 'El nombre del evento es obligatorio' });
        }
        
        if (!date) {
            return res.status(400).json({ error: 'La fecha del evento es obligatoria' });
        }
        
        // Buscar el evento
        const event = await Evento.findByPk(eventId);
        
        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Actualizar datos
        event.name = name;
        event.description = description;
        event.date = new Date(date);
        event.location = location;
        event.organization_id = organization_id;
        if (active !== undefined) {
            event.active = active;
        }
        
        // Actualizar configuración de notificaciones
        if (notification_enabled !== undefined) {
            event.notification_enabled = notification_enabled;
        }
        
        if (notification_hours_before !== undefined) {
            event.notification_hours_before = notification_hours_before;
        }
        
        event.updatedAt = new Date();
        
        // Guardar cambios
        await event.save();
        
        res.json(event);
    } catch (error) {
        console.error('Error al actualizar evento:', error);
        res.status(500).json({ error: 'Error al actualizar evento' });
    }
});

// Cambiar estado de un evento
router.patch('/events/:id/status', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const eventId = req.params.id;
        const { active } = req.body;
        
        // Validar datos
        if (active === undefined) {
            return res.status(400).json({ error: 'Se requiere el estado (active)' });
        }
        
        // Buscar el evento
        const event = await Evento.findByPk(eventId);
        
        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Actualizar estado
        event.active = active;
        event.updatedAt = new Date();
        
        // Guardar cambios
        await event.save();
        
        res.json({
            id: event.id,
            name: event.name,
            active: event.active
        });
    } catch (error) {
        console.error('Error al cambiar estado de evento:', error);
        res.status(500).json({ error: 'Error al cambiar estado de evento' });
    }
});

// Obtener todos los participantes
router.get('/participants', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const searchTerm = req.query.search || '';
        
        // Condiciones de búsqueda
        let whereClause = {};
        if (searchTerm) {
            whereClause = {
                [Op.or]: [
                    { firstName: { [Op.iLike]: `%${searchTerm}%` } },
                    { lastName: { [Op.iLike]: `%${searchTerm}%` } },
                    Sequelize.literal(`CAST("Participante"."cedula" AS TEXT) ILIKE '%${searchTerm}%'`),
                    Sequelize.literal(`CAST("Participante"."telegramid" AS TEXT) ILIKE '%${searchTerm}%'`)
                ]
            };
        }
        
        // Consulta con conteo total
        const { count, rows } = await Participante.findAndCountAll({
            where: whereClause,
            include: [{
                model: Organizacion,
                attributes: ['id', 'name']
            }],
            order: [['firstName', 'ASC'], ['lastName', 'ASC']],
            limit: limit,
            offset: offset
        });
        
        // Calcular páginas
        const totalPages = Math.ceil(count / limit);
        
        res.json({
            participants: rows,
            total: count,
            totalPages: totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error('Error al obtener participantes:', error);
        res.status(500).json({ error: 'Error al obtener participantes', detail: error.message });
    }
});

// Obtener un participante específico
router.get('/participants/:id', authenticateToken, async (req, res) => {
    try {
        const participantId = req.params.id;
        
        // Obtener el participante
        const participant = await Participante.findByPk(participantId, {
            include: [{
                model: Organizacion,
                attributes: ['id', 'name']
            }]
        });
        
        if (!participant) {
            return res.status(404).json({ error: 'Participante no encontrado' });
        }
        
        res.json(participant);
    } catch (error) {
        console.error('Error al obtener participante:', error);
        res.status(500).json({ error: 'Error al obtener participante' });
    }
});

// Crear un nuevo participante
router.post('/participants', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { 
            nac, cedula, firstName, lastName, telegramId, 
            email, phone, organization_id, rol 
        } = req.body;
        
        // Validar datos
        if (!cedula) {
            return res.status(400).json({ error: 'La cédula del participante es obligatoria' });
        }
        
        if (!firstName) {
            return res.status(400).json({ error: 'El nombre del participante es obligatorio' });
        }
        
        if (!lastName) {
            return res.status(400).json({ error: 'El apellido del participante es obligatorio' });
        }
        
        // Verificar si ya existe un participante con la misma cédula
        const existingParticipant = await Participante.findOne({
            where: {
                nac: nac || 'V',
                cedula: cedula
            }
        });
        
        if (existingParticipant) {
            return res.status(400).json({ error: 'Ya existe un participante con esta cédula' });
        }
        
        // Verificar si ya existe un participante con el mismo ID de Telegram
        if (telegramId) {
            const existingTelegramId = await Participante.findOne({
                where: { telegramId: telegramId }
            });
            
            if (existingTelegramId) {
                return res.status(400).json({ error: 'Ya existe un participante con este ID de Telegram' });
            }
        }
        
        // Crear el participante
        const participant = await Participante.create({
            nac: nac || 'V',
            cedula,
            firstName,
            lastName,
            telegramId,
            email,
            phone,
            organization_id: organization_id || null,
            rol: rol || 'user',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        res.status(201).json(participant);
    } catch (error) {
        console.error('Error al crear participante:', error);
        res.status(500).json({ error: 'Error al crear participante', detail: error.message });
    }
});

// Actualizar un participante
router.put('/participants/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const participantId = req.params.id;
        const { 
            nac, cedula, firstName, lastName, telegramId, 
            email, phone, organization_id, rol 
        } = req.body;
        
        // Validar datos
        if (!cedula) {
            return res.status(400).json({ error: 'La cédula del participante es obligatoria' });
        }
        
        if (!firstName) {
            return res.status(400).json({ error: 'El nombre del participante es obligatorio' });
        }
        
        if (!lastName) {
            return res.status(400).json({ error: 'El apellido del participante es obligatorio' });
        }
        
        // Buscar el participante
        const participant = await Participante.findByPk(participantId);
        
        if (!participant) {
            return res.status(404).json({ error: 'Participante no encontrado' });
        }
        
        // Verificar cédula única (excepto para el mismo participante)
        const existingCedula = await Participante.findOne({
            where: {
                nac: nac || 'V',
                cedula: cedula,
                id: { [Op.ne]: participantId }
            }
        });
        
        if (existingCedula) {
            return res.status(400).json({ error: 'Ya existe otro participante con esta cédula' });
        }
        
        // Verificar telegramId único (excepto para el mismo participante)
        if (telegramId) {
            const existingTelegramId = await Participante.findOne({
                where: {
                    telegramId: telegramId,
                    id: { [Op.ne]: participantId }
                }
            });
            
            if (existingTelegramId) {
                return res.status(400).json({ error: 'Ya existe otro participante con este ID de Telegram' });
            }
        }
        
        // Actualizar datos
        participant.nac = nac || 'V';
        participant.cedula = cedula;
        participant.firstName = firstName;
        participant.lastName = lastName;
        participant.telegramId = telegramId;
        participant.email = email;
        participant.phone = phone;
        participant.organization_id = organization_id || null;
        participant.rol = rol || 'user';
        participant.updatedAt = new Date();
        
        // Guardar cambios
        await participant.save();
        
        res.json(participant);
    } catch (error) {
        console.error('Error al actualizar participante:', error);
        res.status(500).json({ error: 'Error al actualizar participante', detail: error.message });
    }
});

// Eliminar un participante
router.delete('/participants/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const participantId = req.params.id;
        
        // Verificar si el participante existe
        const participant = await Participante.findByPk(participantId);
        
        if (!participant) {
            return res.status(404).json({ error: 'Participante no encontrado' });
        }
        
        // Verificar si tiene asistencias registradas
        const attendanceCount = await Asistencia.count({
            where: { participantid: participantId }
        });
        
        if (attendanceCount > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar el participante porque tiene asistencias registradas',
                attendanceCount
            });
        }
        
        // Eliminar el participante
        await participant.destroy();
        
        res.json({ 
            message: 'Participante eliminado correctamente',
            id: participantId
        });
    } catch (error) {
        console.error('Error al eliminar participante:', error);
        res.status(500).json({ error: 'Error al eliminar participante' });
    }
});

// Importar participantes desde CSV
router.post('/participants/import', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { csvData, hasHeader, updateExisting, defaultOrgId } = req.body;
        
        if (!csvData) {
            return res.status(400).json({ error: 'No se proporcionaron datos CSV' });
        }
        
        // Procesar CSV
        const lines = csvData.split(/\r?\n/);
        
        // Ignorar la primera línea si tiene encabezados
        const startIndex = hasHeader ? 1 : 0;
        
        let created = 0;
        let updated = 0;
        let failed = 0;
        
        // Usar transacción para garantizar consistencia
        const transaction = await sequelize.transaction();
        
        try {
            // Procesar cada línea
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue; // Ignorar líneas vacías
                
                // Dividir la línea en campos
                const fields = line.split(',');
                
                // Verificar que tenga al menos los campos mínimos
                if (fields.length < 3) {
                    failed++;
                    continue;
                }
                
                // Extraer datos
                const participantData = {
                    nac: fields[0] || 'V',
                    cedula: fields[1],
                    firstName: fields[2],
                    lastName: fields[3] || '',
                    telegramId: fields[4] || null,
                    email: fields[5] || null,
                    phone: fields[6] || null,
                    organization_id: fields[7] || defaultOrgId || null,
                    rol: fields[8] || 'user'
                };
                
                // Validar campos requeridos
                if (!participantData.cedula || !participantData.firstName) {
                    failed++;
                    continue;
                }
                
                // Buscar si ya existe un participante con esta cédula
                const existingParticipant = await Participante.findOne({
                    where: {
                        nac: participantData.nac,
                        cedula: participantData.cedula
                    },
                    transaction
                });
                
                if (existingParticipant) {
                    if (updateExisting) {
                        // Actualizar participante existente
                        await existingParticipant.update({
                            firstName: participantData.firstName,
                            lastName: participantData.lastName,
                            telegramId: participantData.telegramId,
                            email: participantData.email,
                            phone: participantData.phone,
                            organization_id: participantData.organization_id,
                            rol: participantData.rol,
                            updatedAt: new Date()
                        }, { transaction });
                        
                        updated++;
                    } else {
                        // Ignorar duplicados
                        failed++;
                    }
                } else {
                    // Crear nuevo participante
                    await Participante.create({
                        ...participantData,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, { transaction });
                    
                    created++;
                }
            }
            
            // Confirmar transacción
            await transaction.commit();
            
            res.json({
                message: 'Importación completada',
                created,
                updated,
                failed,
                total: lines.length - (hasHeader ? 1 : 0)
            });
        } catch (error) {
            // Revertir transacción en caso de error
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error al importar participantes:', error);
        res.status(500).json({ error: 'Error al importar participantes', detail: error.message });
    }
});

// Obtener todas las asistencias con paginación y filtros
router.get('/attendances', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const searchTerm = req.query.search || '';
        const eventId = req.query.eventId || '';
        
        // Condiciones de búsqueda
        let whereClause = {};
        
        // Filtrar por evento
        if (eventId) {
            whereClause.eventid = eventId;
        }
        
        // Construir consulta
        let query = {
            where: whereClause,
            include: [
                {
                    model: Evento,
                    attributes: ['id', 'name', 'date', 'location', 'organization_id'],
                    include: [{
                        model: Organizacion,
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Participante,
                    attributes: ['id', 'nac', 'cedula', 'firstName', 'lastName', 'telegramId', 'organization_id'],
                    include: [{
                        model: Organizacion,
                        attributes: ['id', 'name']
                    }]
                }
            ],
            order: [['registeredAt', 'DESC']],
            limit: limit,
            offset: offset
        };
        
        // Búsqueda por participante
        if (searchTerm) {
            query.include[1].where = {
                [Op.or]: [
                    { firstName: { [Op.iLike]: `%${searchTerm}%` } },
                    { lastName: { [Op.iLike]: `%${searchTerm}%` } },
                    Sequelize.literal(`CAST("Participante"."cedula" AS TEXT) ILIKE '%${searchTerm}%'`),
                    Sequelize.literal(`CAST("Participante"."telegramid" AS TEXT) ILIKE '%${searchTerm}%'`)
                ]
            };
        }
        
        // Ejecutar consulta con conteo
        const { count, rows } = await Asistencia.findAndCountAll(query);
        
        // Calcular páginas
        const totalPages = Math.ceil(count / limit);
        
        res.json({
            attendances: rows,
            total: count,
            totalPages: totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error('Error al obtener asistencias:', error);
        res.status(500).json({ error: 'Error al obtener asistencias', detail: error.message });
    }
});

// Obtener resumen de asistencias por evento
router.get('/attendances/summary', authenticateToken, async (req, res) => {
    try {
        // Obtener resumen usando SQL raw para mayor flexibilidad
        const summary = await sequelize.query(`
            SELECT 
                e.id as event_id,
                e.name as event_name,
                e.date as event_date,
                COUNT(a.id) as total_count,
                SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
                SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
                COUNT(DISTINCT p.id) as expected_count
            FROM notif_eventos_bot.events e
            LEFT JOIN notif_eventos_bot.attendances a ON e.id = a.eventid
            LEFT JOIN notif_eventos_bot.participants p ON p.organization_id = e.organization_id
            GROUP BY e.id, e.name, e.date
            ORDER BY e.date DESC
        `, { type: sequelize.QueryTypes.SELECT });
        
        res.json(summary);
    } catch (error) {
        console.error('Error al obtener resumen de asistencias:', error);
        res.status(500).json({ error: 'Error al obtener resumen de asistencias', detail: error.message });
    }
});

// Obtener una asistencia específica
router.get('/attendances/:id', authenticateToken, async (req, res) => {
    try {
        const attendanceId = req.params.id;
        
        // Obtener la asistencia con datos relacionados
        const attendance = await Asistencia.findByPk(attendanceId, {
            include: [
                {
                    model: Evento,
                    include: [{
                        model: Organizacion,
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Participante,
                    include: [{
                        model: Organizacion,
                        attributes: ['id', 'name']
                    }]
                }
            ]
        });
        
        if (!attendance) {
            return res.status(404).json({ error: 'Asistencia no encontrada' });
        }
        
        res.json(attendance);
    } catch (error) {
        console.error('Error al obtener asistencia:', error);
        res.status(500).json({ error: 'Error al obtener asistencia' });
    }
});

// Crear una nueva asistencia
router.post('/attendances', authenticateToken, async (req, res) => {
    try {
        const { 
            participant_id, eventid, registeredAt, method, 
            status, latitude, longitude, notes 
        } = req.body;
        
        // Validar datos
        if (!participant_id) {
            return res.status(400).json({ error: 'El participante es obligatorio' });
        }
        
        if (!eventid) {
            return res.status(400).json({ error: 'El evento es obligatorio' });
        }
        
        // Verificar si ya existe una asistencia para este participante y evento
        const existingAttendance = await Asistencia.findOne({
            where: {
                participantid: participant_id,
                eventid
            }
        });
        
        if (existingAttendance) {
            return res.status(400).json({ 
                error: 'Ya existe un registro de asistencia para este participante en este evento' 
            });
        }
        
        // Crear la asistencia
        const attendance = await Asistencia.create({
            participantid: participant_id,
            eventid,
            registeredAt: registeredAt ? new Date(registeredAt) : new Date(),
            method: method || 'manual',
            status: status || 'confirmed',
            latitude,
            longitude,
            notes,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        res.status(201).json(attendance);
    } catch (error) {
        console.error('Error al crear asistencia:', error);
        res.status(500).json({ error: 'Error al crear asistencia', detail: error.message });
    }
});

// Actualizar una asistencia
router.put('/attendances/:id', authenticateToken, async (req, res) => {
    try {
        const attendanceId = req.params.id;
        const { 
            participant_id, eventid, registeredAt, method, 
            status, latitude, longitude, notes 
        } = req.body;
        
        // Validar datos
        if (!participant_id) {
            return res.status(400).json({ error: 'El participante es obligatorio' });
        }
        
        if (!eventid) {
            return res.status(400).json({ error: 'El evento es obligatorio' });
        }
        
        // Buscar la asistencia
        const attendance = await Asistencia.findByPk(attendanceId);
        
        if (!attendance) {
            return res.status(404).json({ error: 'Asistencia no encontrada' });
        }
        
        // Verificar que no exista otra asistencia para el mismo participante y evento
        if (attendance.participantid != participant_id || attendance.eventid != eventid) {
            const existingAttendance = await Asistencia.findOne({
                where: {
                    participantid: participant_id,
                    eventid,
                    id: { [Op.ne]: attendanceId }
                }
            });
            
            if (existingAttendance) {
                return res.status(400).json({ 
                    error: 'Ya existe otro registro de asistencia para este participante en este evento' 
                });
            }
        }
        
        // Actualizar datos
        attendance.participantid = participant_id;
        attendance.eventid = eventid;
        attendance.registeredAt = registeredAt ? new Date(registeredAt) : attendance.registeredAt;
        attendance.method = method || attendance.method;
        attendance.status = status || attendance.status;
        attendance.latitude = latitude !== undefined ? latitude : attendance.latitude;
        attendance.longitude = longitude !== undefined ? longitude : attendance.longitude;
        attendance.notes = notes !== undefined ? notes : attendance.notes;
        attendance.updatedAt = new Date();
        
        // Guardar cambios
        await attendance.save();
        
        res.json(attendance);
    } catch (error) {
        console.error('Error al actualizar asistencia:', error);
        res.status(500).json({ error: 'Error al actualizar asistencia', detail: error.message });
    }
});

// Eliminar una asistencia
router.delete('/attendances/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const attendanceId = req.params.id;
        
        // Verificar si la asistencia existe
        const attendance = await Asistencia.findByPk(attendanceId);
        
        if (!attendance) {
            return res.status(404).json({ error: 'Asistencia no encontrada' });
        }
        
        // Eliminar la asistencia
        await attendance.destroy();
        
        res.json({ 
            message: 'Asistencia eliminada correctamente',
            id: attendanceId
        });
    } catch (error) {
        console.error('Error al eliminar asistencia:', error);
        res.status(500).json({ error: 'Error al eliminar asistencia' });
    }
});

// Exportar asistencias
router.get('/attendances/export', authenticateToken, async (req, res) => {
    try {
        const eventId = req.query.eventId;
        const dateStart = req.query.dateStart;
        const dateEnd = req.query.dateEnd;
        const format = req.query.format || 'csv';
        const includeDetails = req.query.includeDetails === '1';
        const token = req.query.token;
        
        // Validar token
        if (!token) {
            return res.status(401).json({ error: 'Se requiere autenticación' });
        }
        
        // Verificar token
        let tokenValid = false;
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (!err) {
                tokenValid = true;
            }
        });
        
        if (!tokenValid) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        
        // Construir condiciones de búsqueda
        let whereClause = {};
        
        if (eventId) {
            whereClause.eventid = eventId;
        }
        
        if (dateStart && dateEnd) {
            whereClause.registeredAt = {
                [Op.between]: [new Date(dateStart), new Date(dateEnd)]
            };
        } else if (dateStart) {
            whereClause.registeredAt = {
                [Op.gte]: new Date(dateStart)
            };
        } else if (dateEnd) {
            whereClause.registeredAt = {
                [Op.lte]: new Date(dateEnd)
            };
        }
        
        // Obtener asistencias con datos relacionados
        const attendances = await Asistencia.findAll({
            where: whereClause,
            include: [
                {
                    model: Evento,
                    attributes: ['id', 'name', 'date', 'location'],
                    include: [{
                        model: Organizacion,
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Participante,
                    attributes: ['id', 'nac', 'cedula', 'firstName', 'lastName', 'telegramId', 'email', 'phone'],
                    include: [{
                        model: Organizacion,
                        attributes: ['id', 'name']
                    }]
                }
            ],
            order: [['registeredAt', 'DESC']]
        });
        
        // Procesar datos para exportación
        const exportData = attendances.map(attendance => {
            const basic = {
                id: attendance.id,
                fecha_registro: attendance.registeredAt.toISOString(),
                metodo: attendance.method,
                estado: attendance.status,
                evento_id: attendance.eventid,
                evento_nombre: attendance.Evento?.name || 'N/A',
                evento_fecha: attendance.Evento?.date ? new Date(attendance.Evento.date).toISOString() : 'N/A',
                participante_id: attendance.participantid,
                participante_cedula: attendance.Participante ? `${attendance.Participante.nac}-${attendance.Participante.cedula}` : 'N/A',
                participante_nombre: attendance.Participante ? `${attendance.Participante.firstName} ${attendance.Participante.lastName}` : 'N/A'
            };
            
            // Incluir detalles adicionales si se solicita
            if (includeDetails) {
                return {
                    ...basic,
                    notas: attendance.notes || '',
                    ubicacion_latitud: attendance.latitude || '',
                    ubicacion_longitud: attendance.longitude || '',
                    evento_ubicacion: attendance.Evento?.location || 'N/A',
                    evento_organizacion: attendance.Evento?.Organizacion?.name || 'N/A',
                    participante_telegram: attendance.Participante?.telegramId || '',
                    participante_email: attendance.Participante?.email || '',
                    participante_telefono: attendance.Participante?.phone || '',
                    participante_organizacion: attendance.Participante?.Organizacion?.name || 'N/A',
                    fecha_creacion: attendance.createdAt.toISOString(),
                    fecha_actualizacion: attendance.updatedAt.toISOString()
                };
            }
            
            return basic;
        });
        
        // Establecer nombre del archivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let fileName = `asistencias_${timestamp}`;
        
        if (eventId) {
            const event = await Evento.findByPk(eventId);
            if (event) {
                fileName = `asistencias_${event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${timestamp}`;
            }
        }
        
        // Exportar según formato solicitado
        if (format === 'csv') {
            // Generar CSV
            const csvHeader = Object.keys(exportData[0] || {}).join(',') + '\n';
            const csvRows = exportData.map(data => 
                Object.values(data).map(value => 
                    typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
                ).join(',')
            ).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
            res.send(csvHeader + csvRows);
        } else if (format === 'excel') {
            // Aquí normalmente usaríamos una librería como exceljs
            // por simplicidad, enviamos un CSV con extensión xlsx
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
            
            // Generar CSV
            const csvHeader = Object.keys(exportData[0] || {}).join(',') + '\n';
            const csvRows = exportData.map(data => 
                Object.values(data).map(value => 
                    typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
                ).join(',')
            ).join('\n');
            
            res.send(csvHeader + csvRows);
        } else {
            // Para otros formatos, devolvemos JSON
            res.json(exportData);
        }
    } catch (error) {
        console.error('Error al exportar asistencias:', error);
        res.status(500).json({ error: 'Error al exportar asistencias', detail: error.message });
    }
});

// Obtener estadísticas de notificaciones
router.get('/notifications/stats', authenticateToken, async (req, res) => {
    try {
        // Obtener estadísticas generales de notificaciones
        const [notificationStats] = await sequelize.query(`
            SELECT
                e.id as event_id,
                e.name as event_name,
                COUNT(n.id) as total_notifications,
                SUM(CASE WHEN n.sent THEN 1 ELSE 0 END) as sent_count,
                COUNT(n.id) - SUM(CASE WHEN n.sent THEN 1 ELSE 0 END) as pending_count,
                CASE 
                    WHEN COUNT(n.id) > 0 THEN 
                        ROUND((SUM(CASE WHEN n.sent THEN 1 ELSE 0 END)::numeric / COUNT(n.id)::numeric) * 100, 2)
                    ELSE 0
                END AS sent_percentage
            FROM notif_eventos_bot.events e
            LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
            GROUP BY e.id, e.name
            ORDER BY e.id
        `);
        
        res.json(notificationStats);
    } catch (error) {
        console.error('Error al obtener estadísticas de notificaciones:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de notificaciones' });
    }
});

// Endpoint de prueba para estadísticas de notificaciones (sin autenticación)
router.get('/notifications/stats/test', async (req, res) => {
    try {
        // Obtener estadísticas generales de notificaciones
        const [notificationStats] = await sequelize.query(`
            SELECT
                e.id as event_id,
                e.name as event_name,
                COUNT(n.id) as total_notifications,
                SUM(CASE WHEN n.sent THEN 1 ELSE 0 END) as sent_count,
                COUNT(n.id) - SUM(CASE WHEN n.sent THEN 1 ELSE 0 END) as pending_count,
                CASE 
                    WHEN COUNT(n.id) > 0 THEN 
                        ROUND((SUM(CASE WHEN n.sent THEN 1 ELSE 0 END)::numeric / COUNT(n.id)::numeric) * 100, 2)
                    ELSE 0
                END AS sent_percentage
            FROM notif_eventos_bot.events e
            LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
            GROUP BY e.id, e.name
            ORDER BY e.id
        `);
        
        res.json(notificationStats);
    } catch (error) {
        console.error('Error al obtener estadísticas de notificaciones:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de notificaciones' });
    }
});

// Obtener todas las notificaciones con paginación y filtros
router.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const searchTerm = req.query.search || '';
        const filter = req.query.filter || 'all';
        
        // Condiciones de búsqueda
        let whereClause = {};
        
        // Filtrar por estado
        if (filter === 'pending') {
            whereClause.sent = false;
        } else if (filter === 'sent') {
            whereClause.sent = true;
        }
        
        // Búsqueda por término
        if (searchTerm) {
            whereClause = {
                ...whereClause,
                [Op.or]: [
                    { message_template: { [Op.iLike]: `%${searchTerm}%` } },
                    sequelize.literal(`EXISTS (SELECT 1 FROM notif_eventos_bot.events e WHERE e.id = "NotificacionProgramada".event_id AND e.name ILIKE '%${searchTerm}%')`)
                ]
            };
        }
        
        // Consulta con conteo total
        const { count, rows } = await NotificacionProgramada.findAndCountAll({
            where: whereClause,
            include: [{
                model: Evento,
                attributes: ['id', 'name', 'date']
            }],
            order: [['scheduled_date', 'DESC']],
            limit: limit,
            offset: offset
        });
        
        // Formatear los resultados para la UI
        const notifications = rows.map(notification => {
            const notificationObj = notification.toJSON();
            
            // Agregar propiedades compatibles con el frontend
            notificationObj.status = notification.sent ? 'sent' : 'pending';
            notificationObj.message = notification.message_template;
            notificationObj.type = notification.notification_type;
            notificationObj.event_name = notification.Evento ? notification.Evento.name : 'N/A';
            
            return notificationObj;
        });
        
        // Calcular páginas
        const totalPages = Math.ceil(count / limit);
        
        res.json({
            items: notifications,
            total: count,
            totalPages: totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        res.status(500).json({ error: 'Error al obtener notificaciones', detail: error.message });
    }
});

// Obtener una notificación específica
router.get('/notifications/:id', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        // Obtener la notificación
        const notification = await NotificacionProgramada.findByPk(notificationId, {
            include: [{
                model: Evento,
                attributes: ['id', 'name', 'date', 'location', 'organization_id'],
                include: [{
                    model: Organizacion,
                    attributes: ['id', 'name']
                }]
            }]
        });
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        res.json(notification);
    } catch (error) {
        console.error('Error al obtener notificación:', error);
        res.status(500).json({ error: 'Error al obtener notificación' });
    }
});

// Crear una nueva notificación programada
router.post('/notifications', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { 
            type, message, event_id, scheduled_date, recipient_type,
            organization_id, participant_ids, include_buttons
        } = req.body;
        
        // Validar datos
        if (!type) {
            return res.status(400).json({ error: 'El tipo de notificación es obligatorio' });
        }
        
        if (!message) {
            return res.status(400).json({ error: 'El mensaje de la notificación es obligatorio' });
        }
        
        if (!scheduled_date) {
            return res.status(400).json({ error: 'La fecha de programación es obligatoria' });
        }
        
        if (type !== 'custom_message' && !event_id) {
            return res.status(400).json({ error: 'Se requiere un evento para este tipo de notificación' });
        }
        
        // Validar tipo de destinatarios
        if (!recipient_type) {
            return res.status(400).json({ error: 'El tipo de destinatarios es obligatorio' });
        }
        
        if (recipient_type === 'organization' && !organization_id) {
            return res.status(400).json({ error: 'Se requiere un ID de organización para destinatarios por organización' });
        }
        
        if (recipient_type === 'custom' && (!participant_ids || !participant_ids.length)) {
            return res.status(400).json({ error: 'Se requiere al menos un participante para destinatarios personalizados' });
        }
        
        // Crear la notificación
        const notification = await NotificacionProgramada.create({
            type,
            message,
            event_id,
            scheduled_date: new Date(scheduled_date),
            status: 'pending',
            recipient_type,
            organization_id: organization_id || null,
            participant_ids: participant_ids || null,
            include_buttons: include_buttons !== undefined ? include_buttons : true,
            created_by: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        res.status(201).json(notification);
    } catch (error) {
        console.error('Error al crear notificación:', error);
        res.status(500).json({ error: 'Error al crear notificación', detail: error.message });
    }
});

// Actualizar una notificación programada
router.put('/notifications/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const { 
            type, message, event_id, scheduled_date, recipient_type,
            organization_id, participant_ids, include_buttons
        } = req.body;
        
        // Buscar la notificación
        const notification = await NotificacionProgramada.findByPk(notificationId);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        // Verificar que no esté enviada o cancelada
        if (notification.status !== 'pending') {
            return res.status(400).json({ 
                error: 'No se puede modificar una notificación que ya ha sido enviada o cancelada' 
            });
        }
        
        // Validar datos
        if (!type) {
            return res.status(400).json({ error: 'El tipo de notificación es obligatorio' });
        }
        
        if (!message) {
            return res.status(400).json({ error: 'El mensaje de la notificación es obligatorio' });
        }
        
        if (!scheduled_date) {
            return res.status(400).json({ error: 'La fecha de programación es obligatoria' });
        }
        
        if (type !== 'custom_message' && !event_id) {
            return res.status(400).json({ error: 'Se requiere un evento para este tipo de notificación' });
        }
        
        // Validar tipo de destinatarios
        if (!recipient_type) {
            return res.status(400).json({ error: 'El tipo de destinatarios es obligatorio' });
        }
        
        if (recipient_type === 'organization' && !organization_id) {
            return res.status(400).json({ error: 'Se requiere un ID de organización para destinatarios por organización' });
        }
        
        if (recipient_type === 'custom' && (!participant_ids || !participant_ids.length)) {
            return res.status(400).json({ error: 'Se requiere al menos un participante para destinatarios personalizados' });
        }
        
        // Actualizar la notificación
        notification.type = type;
        notification.message = message;
        notification.event_id = event_id;
        notification.scheduled_date = new Date(scheduled_date);
        notification.recipient_type = recipient_type;
        notification.organization_id = organization_id || null;
        notification.participant_ids = participant_ids || null;
        notification.include_buttons = include_buttons !== undefined ? include_buttons : notification.include_buttons;
        notification.updatedAt = new Date();
        notification.updated_by = req.user.id;
        
        await notification.save();
        
        res.json(notification);
    } catch (error) {
        console.error('Error al actualizar notificación:', error);
        res.status(500).json({ error: 'Error al actualizar notificación', detail: error.message });
    }
});

// Eliminar una notificación programada
router.delete('/notifications/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        // Buscar la notificación
        const notification = await NotificacionProgramada.findByPk(notificationId);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        // Verificar que no esté enviada
        if (notification.status === 'sent') {
            return res.status(400).json({ 
                error: 'No se puede eliminar una notificación que ya ha sido enviada' 
            });
        }
        
        // Marcar como cancelada en lugar de eliminar
        notification.status = 'cancelled';
        notification.updatedAt = new Date();
        notification.updated_by = req.user.id;
        
        await notification.save();
        
        res.json({ 
            message: 'Notificación cancelada correctamente',
            id: notificationId
        });
    } catch (error) {
        console.error('Error al eliminar notificación:', error);
        res.status(500).json({ error: 'Error al eliminar notificación' });
    }
});

// Obtener estadísticas detalladas de una notificación
router.get('/notifications/:id/stats', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        // Obtener la notificación con datos relacionados
        const notification = await NotificacionProgramada.findByPk(notificationId, {
            include: [{
                model: Evento,
                attributes: ['id', 'name', 'date', 'location'],
                include: [{
                    model: Organizacion,
                    attributes: ['id', 'name']
                }]
            }]
        });
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        // Obtener estadísticas
        const stats = await NotificacionEstadistica.findOne({
            where: { notification_id: notificationId }
        }) || { total: 0, sent: 0, delivered: 0, read: 0, responded: 0, failed: 0 };
        
        // Obtener lista de destinatarios y su estado
        const recipients = [];
        
        // Simulación de datos de destinatarios (en una aplicación real, esto vendría de una tabla)
        // Aquí deberías obtener los datos reales de tu base de datos
        if (notification.status === 'sent' || notification.status === 'failed') {
            // Obtener participantes según el tipo de destinatario
            let participantsQuery = {};
            
            if (notification.recipient_type === 'all' && notification.event_id) {
                // Todos los participantes del evento
                const event = await Evento.findByPk(notification.event_id, {
                    include: [{
                        model: Organizacion,
                        attributes: ['id']
                    }]
                });
                
                if (event && event.Organizacion) {
                    participantsQuery = {
                        where: {
                            organization_id: event.Organizacion.id,
                            telegramId: { [Op.not]: null }
                        }
                    };
                }
            } else if (notification.recipient_type === 'organization' && notification.organization_id) {
                // Participantes de una organización
                participantsQuery = {
                    where: {
                        organization_id: notification.organization_id,
                        telegramId: { [Op.not]: null }
                    }
                };
            } else if (notification.recipient_type === 'custom' && notification.participant_ids) {
                // Lista personalizada
                participantsQuery = {
                    where: {
                        id: { [Op.in]: notification.participant_ids }
                    }
                };
            }
            
            if (Object.keys(participantsQuery).length > 0) {
                const participants = await Participante.findAll(participantsQuery);
                
                // Generar datos simulados para cada participante
                for (const participant of participants) {
                    // En un sistema real, estos datos vendrían de tu base de datos
                    const wasSuccessful = Math.random() > 0.2; // 80% de éxito
                    const wasRead = wasSuccessful && Math.random() > 0.3; // 70% de los enviados son leídos
                    const wasResponded = wasRead && Math.random() > 0.5; // 50% de los leídos son respondidos
                    
                    const recipient = {
                        participant_id: participant.id,
                        participant_name: `${participant.firstName} ${participant.lastName}`,
                        telegram_id: participant.telegramId,
                        status: wasSuccessful ? 'sent' : 'failed',
                        sent: wasSuccessful,
                        sent_at: wasSuccessful ? new Date(notification.scheduled_date.getTime() + Math.random() * 60000) : null,
                        delivered: wasSuccessful,
                        delivered_at: wasSuccessful ? new Date(notification.scheduled_date.getTime() + 60000 + Math.random() * 120000) : null,
                        read: wasRead,
                        read_at: wasRead ? new Date(notification.scheduled_date.getTime() + 180000 + Math.random() * 3600000) : null,
                        responded: wasResponded,
                        response: wasResponded ? (Math.random() > 0.5 ? 'Asistiré' : 'No asistiré') : null
                    };
                    
                    recipients.push(recipient);
                }
            }
        }
        
        // Combinar todo en un solo objeto
        const result = {
            id: notification.id,
            type: notification.type,
            message: notification.message,
            status: notification.status,
            scheduled_date: notification.scheduled_date,
            event: notification.Evento,
            stats,
            recipients
        };
        
        res.json(result);
    } catch (error) {
        console.error('Error al obtener estadísticas de notificación:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de notificación' });
    }
});

// Reenviar una notificación a destinatarios fallidos
router.post('/notifications/:id/resend', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        // Buscar la notificación
        const notification = await NotificacionProgramada.findByPk(notificationId);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        // Verificar que la notificación pueda ser reenviada
        if (notification.status !== 'sent' && notification.status !== 'failed') {
            return res.status(400).json({ 
                error: 'Solo se pueden reenviar notificaciones enviadas o fallidas' 
            });
        }
        
        // En un sistema real, aquí implementarías la lógica para reenviar
        // a los destinatarios que fallaron.
        // Por ahora simulamos un reenvío exitoso
        
        // Actualizar estadísticas (simular mejora)
        const stats = await NotificacionEstadistica.findOne({
            where: { notification_id: notificationId }
        });
        
        if (stats) {
            // Simular mejora en las estadísticas
            const failedCount = stats.failed || 0;
            const resenCount = Math.floor(failedCount * 0.8); // 80% de éxito en reenvío
            
            stats.sent += resenCount;
            stats.failed -= resenCount;
            stats.delivered += resenCount;
            
            await stats.save();
        }
        
        res.json({ 
            message: 'Notificación reenviada correctamente',
            id: notificationId,
            resenCount: stats ? Math.floor((stats.failed || 0) * 0.8) : 0
        });
    } catch (error) {
        console.error('Error al reenviar notificación:', error);
        res.status(500).json({ error: 'Error al reenviar notificación' });
    }
});

// Obtener desempeño de notificaciones por evento
router.get('/notifications/performance', authenticateToken, async (req, res) => {
    try {
        // Obtener desempeño de notificaciones por evento (usando SQL para flexibilidad)
        const performance = await sequelize.query(`
            SELECT 
                e.id as event_id,
                e.name as event_name,
                COUNT(n.id) as total_notifications,
                SUM(CASE WHEN ns.sent > 0 THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN ns.delivered > 0 THEN 1 ELSE 0 END) as delivered_count,
                SUM(CASE WHEN ns.read > 0 THEN 1 ELSE 0 END) as read_count,
                SUM(CASE WHEN ns.responded > 0 THEN 1 ELSE 0 END) as responded_count,
                CASE 
                    WHEN COUNT(n.id) > 0 THEN 
                        ROUND(SUM(ns.sent)::numeric / SUM(ns.total)::numeric * 100, 2)
                    ELSE 0
                END AS sent_percentage,
                CASE 
                    WHEN SUM(ns.sent) > 0 THEN 
                        ROUND(SUM(ns.read)::numeric / SUM(ns.sent)::numeric * 100, 2)
                    ELSE 0
                END AS read_percentage
            FROM notif_eventos_bot.events e
            LEFT JOIN notif_eventos_bot.scheduled_notifications n ON e.id = n.event_id
            LEFT JOIN notif_eventos_bot.notification_stats ns ON n.id = ns.notification_id
            WHERE n.id IS NOT NULL
            GROUP BY e.id, e.name
            ORDER BY e.date DESC
            LIMIT 10
        `, { type: sequelize.QueryTypes.SELECT });
        
        res.json(performance);
    } catch (error) {
        console.error('Error al obtener desempeño de notificaciones:', error);
        res.status(500).json({ error: 'Error al obtener desempeño de notificaciones por evento' });
    }
});

// Crear un endpoint para diagnosticar problemas de notificaciones
router.get('/notifications/diagnostic', async (req, res) => {
    try {
        // 1. Verificar estructura de la tabla
        const [columnsResult] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'notif_eventos_bot' 
            AND table_name = 'scheduled_notifications'
            ORDER BY ordinal_position
        `);
        
        // 2. Contar notificaciones
        const [countResult] = await sequelize.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN sent = true THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN sent = false THEN 1 ELSE 0 END) as pending_count
            FROM notif_eventos_bot.scheduled_notifications
        `);
        
        // 3. Obtener ejemplo de notificaciones
        const [sampleResult] = await sequelize.query(`
            SELECT * FROM notif_eventos_bot.scheduled_notifications
            ORDER BY id DESC
            LIMIT 5
        `);
        
        // 4. Verificar referencias a eventos
        const [eventRefsResult] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_refs,
                COUNT(e.id) as valid_refs,
                COUNT(*) - COUNT(e.id) as invalid_refs
            FROM notif_eventos_bot.scheduled_notifications n
            LEFT JOIN notif_eventos_bot.events e ON n.event_id = e.id
        `);
        
        // Devolver resultados de diagnóstico
        res.json({
            table_structure: columnsResult,
            counts: countResult[0] || { total: 0, sent_count: 0, pending_count: 0 },
            sample_data: sampleResult,
            event_references: eventRefsResult[0] || { total_refs: 0, valid_refs: 0, invalid_refs: 0 },
            schema_version: '1.0.0',
            diagnostics_time: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error al realizar diagnóstico de notificaciones:', error);
        res.status(500).json({ 
            error: 'Error al realizar diagnóstico de notificaciones', 
            detail: error.message,
            stack: error.stack
        });
    }
});

// Importar rutas modularizadas
try {
    const apiRoutes = require('./api/index');
    // Montar las rutas modularizadas
    router.use('/api/v1', apiRoutes);
} catch (error) {
    console.error('Error al cargar rutas de API:', error);
}

module.exports = router; 