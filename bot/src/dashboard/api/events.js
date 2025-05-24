const express = require('express');
const router = express.Router();
const { authenticateToken, checkAdminRole } = require('../middleware/auth');
const { sequelize, Sequelize, Op } = require('./db');
const { Evento, Organizacion } = require('./models');

// Obtener lista de eventos
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const searchTerm = req.query.search || '';
        const organizationId = req.query.organizationId || null;
        
        // Construir la consulta base con JOIN a organizaciones
        let query = `
            SELECT 
                e.id,
                e.name,
                e.description,
                e.date,
                e.location,
                e.active as is_active,
                o.name as organization_name,
                o.id as organization_id,
                (SELECT COUNT(*) FROM notif_eventos_bot.attendances a WHERE a.eventid = e.id) as attendance_count
            FROM notif_eventos_bot.events e
            LEFT JOIN notif_eventos_bot.organizations o ON e.organization_id = o.id
            WHERE 1=1
        `;
        
        // Añadir condiciones de filtrado
        const replacements = {};
        
        if (searchTerm) {
            query += ` AND (e.name ILIKE :searchTerm OR e.description ILIKE :searchTerm)`;
            replacements.searchTerm = `%${searchTerm}%`;
        }
        
        if (organizationId) {
            query += ` AND e.organization_id = :organizationId`;
            replacements.organizationId = organizationId;
        }
        
        // Añadir ordenamiento (eventos más recientes primero)
        query += ` ORDER BY e.date DESC`;
        
        // Consulta para contar el total de registros (para paginación)
        const countQuery = `
            SELECT COUNT(*) FROM (${query}) as subquery
        `;
        
        // Añadir paginación
        query += ` LIMIT :limit OFFSET :offset`;
        replacements.limit = limit;
        replacements.offset = offset;
        
        // Ejecutar las consultas
        const [events] = await sequelize.query(query, { replacements });
        const [countResult] = await sequelize.query(countQuery, { replacements, plain: true });
        
        const totalItems = parseInt(countResult.count);
        const totalPages = Math.ceil(totalItems / limit);
        
        res.json({
            items: events,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages
            }
        });
    } catch (error) {
        console.error('Error al obtener eventos:', error);
        res.status(500).json({ error: 'Error al obtener eventos', details: error.message });
    }
});

// Obtener eventos recientes para el dashboard
router.get('/recent', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        
        const query = `
            SELECT 
                e.id,
                e.name,
                e.date,
                o.name as organization_name,
                (SELECT COUNT(*) FROM notif_eventos_bot.attendances a WHERE a.eventid = e.id) as attendance_count
            FROM notif_eventos_bot.events e
            LEFT JOIN notif_eventos_bot.organizations o ON e.organization_id = o.id
            WHERE e.date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY e.date DESC
            LIMIT :limit
        `;
        
        const [events] = await sequelize.query(query, { 
            replacements: { limit }
        });
        
        res.json(events);
    } catch (error) {
        console.error('Error al obtener eventos recientes:', error);
        res.status(500).json({ error: 'Error al obtener eventos recientes' });
    }
});

// Obtener detalle de un evento
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.id;
        
        const query = `
            SELECT 
                e.id,
                e.name,
                e.description,
                e.date,
                e.location,
                e.active as is_active,
                e.organization_id,
                e.notification_hours_before,
                e.notification_enabled,
                o.name as organization_name
            FROM notif_eventos_bot.events e
            LEFT JOIN notif_eventos_bot.organizations o ON e.organization_id = o.id
            WHERE e.id = :eventId
        `;
        
        const [event] = await sequelize.query(query, { 
            replacements: { eventId },
            plain: true
        });
        
        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        res.json(event);
    } catch (error) {
        console.error('Error al obtener detalles del evento:', error);
        res.status(500).json({ error: 'Error al obtener detalles del evento' });
    }
});

// Crear un nuevo evento
router.post('/', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { 
            name, 
            description, 
            date, 
            location, 
            organizationId, 
            isActive = true,
            notificationEnabled = true,
            notificationHoursBefore = 24
        } = req.body;
        
        // Validar datos obligatorios
        if (!name || !date) {
            return res.status(400).json({ error: 'Nombre y fecha son obligatorios' });
        }
        
        // Insertar nuevo evento
        const insertQuery = `
            INSERT INTO notif_eventos_bot.events (
                name, 
                description, 
                date, 
                location, 
                organization_id,
                active,
                notification_enabled,
                notification_hours_before,
                createdat,
                updatedat
            ) VALUES (
                :name, 
                :description, 
                :date, 
                :location, 
                :organizationId,
                :isActive,
                :notificationEnabled,
                :notificationHoursBefore,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;
        
        const [result] = await sequelize.query(insertQuery, { 
            replacements: { 
                name, 
                description: description || null, 
                date, 
                location: location || null, 
                organizationId: organizationId || null,
                isActive,
                notificationEnabled,
                notificationHoursBefore
            },
            plain: true
        });
        
        res.status(201).json({
            id: result.id,
            name,
            description,
            date,
            location,
            organizationId,
            isActive,
            notificationEnabled,
            notificationHoursBefore,
            created: true
        });
    } catch (error) {
        console.error('Error al crear evento:', error);
        res.status(500).json({ error: 'Error al crear evento', details: error.message });
    }
});

// Actualizar un evento existente
router.put('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const eventId = req.params.id;
        const { 
            name, 
            description, 
            date, 
            location, 
            organizationId, 
            isActive,
            notificationEnabled,
            notificationHoursBefore
        } = req.body;
        
        // Validar datos obligatorios
        if (!name || !date) {
            return res.status(400).json({ error: 'Nombre y fecha son obligatorios' });
        }
        
        // Verificar si el evento existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.events WHERE id = :eventId`;
        const [existingEvent] = await sequelize.query(checkQuery, { 
            replacements: { eventId },
            plain: true
        });
        
        if (!existingEvent) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Actualizar evento
        const updateQuery = `
            UPDATE notif_eventos_bot.events SET
                name = :name,
                description = :description,
                date = :date,
                location = :location,
                organization_id = :organizationId,
                active = :isActive,
                notification_enabled = :notificationEnabled,
                notification_hours_before = :notificationHoursBefore,
                updatedat = CURRENT_TIMESTAMP
            WHERE id = :eventId
        `;
        
        await sequelize.query(updateQuery, { 
            replacements: { 
                eventId,
                name, 
                description: description || null, 
                date, 
                location: location || null, 
                organizationId: organizationId || null,
                isActive: isActive !== undefined ? isActive : true,
                notificationEnabled: notificationEnabled !== undefined ? notificationEnabled : true,
                notificationHoursBefore: notificationHoursBefore || 24
            }
        });
        
        res.json({
            id: eventId,
            name,
            description,
            date,
            location,
            organizationId,
            isActive,
            notificationEnabled,
            notificationHoursBefore,
            updated: true
        });
    } catch (error) {
        console.error('Error al actualizar evento:', error);
        res.status(500).json({ error: 'Error al actualizar evento' });
    }
});

// Cambiar estado de un evento (activar/desactivar)
router.patch('/:id/toggle-status', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const eventId = req.params.id;
        const { active } = req.body;
        
        if (active === undefined) {
            return res.status(400).json({ error: 'Se requiere el parámetro active' });
        }
        
        // Verificar si el evento existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.events WHERE id = :eventId`;
        const [existingEvent] = await sequelize.query(checkQuery, { 
            replacements: { eventId },
            plain: true
        });
        
        if (!existingEvent) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Actualizar estado
        const updateQuery = `
            UPDATE notif_eventos_bot.events SET
                active = :active,
                updatedat = CURRENT_TIMESTAMP
            WHERE id = :eventId
        `;
        
        await sequelize.query(updateQuery, { 
            replacements: { 
                eventId,
                active
            }
        });
        
        res.json({
            id: eventId,
            active,
            updated: true
        });
    } catch (error) {
        console.error('Error al cambiar estado del evento:', error);
        res.status(500).json({ error: 'Error al cambiar estado del evento' });
    }
});

// Eliminar un evento
router.delete('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const eventId = req.params.id;
        
        // Verificar si el evento existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.events WHERE id = :eventId`;
        const [existingEvent] = await sequelize.query(checkQuery, { 
            replacements: { eventId },
            plain: true
        });
        
        if (!existingEvent) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Verificar si hay asistencias relacionadas
        const checkAttendancesQuery = `
            SELECT COUNT(*) as count FROM notif_eventos_bot.attendances WHERE eventid = :eventId
        `;
        
        const [attendanceResult] = await sequelize.query(checkAttendancesQuery, { 
            replacements: { eventId },
            plain: true
        });
        
        if (attendanceResult.count > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar el evento porque tiene asistencias registradas',
                count: attendanceResult.count
            });
        }
        
        // Eliminar evento
        const deleteQuery = `DELETE FROM notif_eventos_bot.events WHERE id = :eventId`;
        await sequelize.query(deleteQuery, { replacements: { eventId } });
        
        res.json({
            id: eventId,
            deleted: true
        });
    } catch (error) {
        console.error('Error al eliminar evento:', error);
        res.status(500).json({ error: 'Error al eliminar evento' });
    }
});

// Endpoint de prueba para obtener eventos sin autenticación (solo para desarrollo)
router.get('/test', async (req, res) => {
    try {
        const query = `
            SELECT 
                e.id,
                e.name,
                e.description,
                e.date,
                e.location,
                e.active as is_active,
                o.name as organization_name,
                o.id as organization_id,
                (SELECT COUNT(*) FROM notif_eventos_bot.attendances a WHERE a.eventid = e.id) as attendance_count
            FROM notif_eventos_bot.events e
            LEFT JOIN notif_eventos_bot.organizations o ON e.organization_id = o.id
            ORDER BY e.date DESC
            LIMIT 10
        `;
        
        const [events] = await sequelize.query(query);
        
        res.json(events);
    } catch (error) {
        console.error('Error al obtener eventos (test):', error);
        res.status(500).json({ error: 'Error al obtener eventos' });
    }
});

module.exports = router; 