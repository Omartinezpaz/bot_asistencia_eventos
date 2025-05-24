const express = require('express');
const router = express.Router();
const { authenticateToken, checkAdminRole } = require('../middleware/auth');
const { sequelize, Evento, NotificacionProgramada, NotificacionEstadistica } = require('../../database');
const NotificationService = require('../../services/notification-service');
const NotificationScheduler = require('../../notification-scheduler');
const { Telegraf } = require('telegraf');
const logger = require('../../utils/logger');

// Crear instancias temporales para cuando se necesiten usar directamente
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const tempBot = botToken ? new Telegraf(botToken) : null;
const notificationService = tempBot ? new NotificationService(tempBot.telegram) : null;

// Obtener todas las notificaciones programadas
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const eventId = req.query.eventId;
        
        // Construir consulta base
        let query = `
            SELECT 
                n.id,
                n.event_id,
                e.name as event_name,
                n.message,
                n.scheduled_date,
                n.status,
                n.notification_type,
                n.created_at,
                n.updated_at
            FROM notif_eventos_bot.scheduled_notifications n
            LEFT JOIN notif_eventos_bot.events e ON n.event_id = e.id
            WHERE 1=1
        `;
        
        const replacements = {};
        
        // Filtrar por evento si se especifica
        if (eventId) {
            query += ` AND n.event_id = :eventId`;
            replacements.eventId = eventId;
        }
        
        // Ordenar por fecha programada descendente
        query += ` ORDER BY n.scheduled_date DESC`;
        
        // Contar total para paginación
        const countQuery = `SELECT COUNT(*) FROM (${query}) as subquery`;
        
        // Agregar paginación
        query += ` LIMIT :limit OFFSET :offset`;
        replacements.limit = limit;
        replacements.offset = offset;
        
        // Ejecutar consultas
        const [notifications] = await sequelize.query(query, { replacements });
        const [countResult] = await sequelize.query(countQuery, { replacements, plain: true });
        
        const totalItems = parseInt(countResult.count);
        const totalPages = Math.ceil(totalItems / limit);
        
        res.json({
            items: notifications,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages
            }
        });
    } catch (error) {
        logger.exception(error, 'Error al obtener notificaciones programadas');
        res.status(500).json({ error: 'Error al obtener notificaciones programadas' });
    }
});

// Obtener una notificación específica
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        const query = `
            SELECT 
                n.id,
                n.event_id,
                e.name as event_name,
                n.message,
                n.scheduled_date,
                n.status,
                n.notification_type,
                n.created_at,
                n.updated_at
            FROM notif_eventos_bot.scheduled_notifications n
            LEFT JOIN notif_eventos_bot.events e ON n.event_id = e.id
            WHERE n.id = :notificationId
        `;
        
        const [notification] = await sequelize.query(query, { 
            replacements: { notificationId },
            plain: true
        });
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        res.json(notification);
    } catch (error) {
        logger.exception(error, 'Error al obtener notificación');
        res.status(500).json({ error: 'Error al obtener notificación' });
    }
});

// Programar notificaciones automáticas para un evento
router.post('/schedule', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { eventId } = req.body;
        
        if (!eventId) {
            return res.status(400).json({ error: 'El ID del evento es obligatorio' });
        }
        
        if (!notificationService) {
            return res.status(500).json({ error: 'Servicio de notificaciones no disponible' });
        }
        
        // Verificar que el evento existe
        const [event] = await sequelize.query(
            'SELECT id, name FROM notif_eventos_bot.events WHERE id = :eventId',
            { replacements: { eventId }, plain: true }
        );
        
        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Programar notificaciones para el evento
        const notifications = await notificationService.scheduleAutomaticNotifications(eventId);
        
        res.json({
            success: true,
            message: `Se han programado ${notifications.length} notificaciones para el evento`,
            notifications
        });
    } catch (error) {
        logger.exception(error, 'Error al programar notificaciones');
        res.status(500).json({ error: 'Error al programar notificaciones', details: error.message });
    }
});

// Enviar notificaciones pendientes
router.post('/send-pending', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { forceAll } = req.body;
        
        if (!notificationService) {
            return res.status(500).json({ error: 'Servicio de notificaciones no disponible' });
        }
        
        // Enviar notificaciones pendientes
        const sentCount = await notificationService.sendPendingNotifications(forceAll);
        
        res.json({
            success: true,
            message: `Se han enviado ${sentCount} notificaciones pendientes`,
            sentCount
        });
    } catch (error) {
        logger.exception(error, 'Error al enviar notificaciones pendientes');
        res.status(500).json({ error: 'Error al enviar notificaciones pendientes', details: error.message });
    }
});

// Crear una notificación personalizada
router.post('/', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { 
            eventId, 
            message, 
            scheduledTime, 
            notificationType = 'custom',
            recipientType = 'all'  // 'all', 'confirmed', 'pending'
        } = req.body;
        
        if (!eventId || !message) {
            return res.status(400).json({ error: 'El ID del evento y el mensaje son obligatorios' });
        }
        
        // Verificar que el evento existe
        const [event] = await sequelize.query(
            'SELECT id, name FROM notif_eventos_bot.events WHERE id = :eventId',
            { replacements: { eventId }, plain: true }
        );
        
        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Crear la notificación programada
        const insertQuery = `
            INSERT INTO notif_eventos_bot.scheduled_notifications (
                event_id,
                message,
                scheduled_date,
                status,
                notification_type,
                recipient_type,
                created_at,
                updated_at
            ) VALUES (
                :eventId,
                :message,
                :scheduledTime,
                'pending',
                :notificationType,
                :recipientType,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;
        
        const [result] = await sequelize.query(insertQuery, {
            replacements: {
                eventId,
                message,
                scheduledTime: scheduledTime || new Date(),
                notificationType,
                recipientType
            },
            plain: true
        });
        
        // Obtener la notificación creada
        const query = `
            SELECT 
                n.id,
                n.event_id,
                e.name as event_name,
                n.message,
                n.scheduled_date,
                n.status,
                n.notification_type,
                n.recipient_type,
                n.created_at,
                n.updated_at
            FROM notif_eventos_bot.scheduled_notifications n
            LEFT JOIN notif_eventos_bot.events e ON n.event_id = e.id
            WHERE n.id = :notificationId
        `;
        
        const [notification] = await sequelize.query(query, { 
            replacements: { notificationId: result.id },
            plain: true
        });
        
        res.status(201).json({
            success: true,
            message: 'Notificación creada correctamente',
            notification
        });
    } catch (error) {
        logger.exception(error, 'Error al crear notificación');
        res.status(500).json({ error: 'Error al crear notificación', details: error.message });
    }
});

// Actualizar una notificación
router.put('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const { 
            message, 
            scheduledTime, 
            status,
            recipientType
        } = req.body;
        
        // Verificar si la notificación existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.scheduled_notifications WHERE id = :notificationId`;
        const [existingNotification] = await sequelize.query(checkQuery, { 
            replacements: { notificationId },
            plain: true
        });
        
        if (!existingNotification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        // Construir la consulta de actualización dinámica
        let updateQuery = `
            UPDATE notif_eventos_bot.scheduled_notifications SET
                updated_at = CURRENT_TIMESTAMP
        `;
        
        const replacements = { notificationId };
        
        if (message !== undefined) {
            updateQuery += `, message = :message`;
            replacements.message = message;
        }
        
        if (scheduledTime !== undefined) {
            updateQuery += `, scheduled_date = :scheduledTime`;
            replacements.scheduledTime = scheduledTime;
        }
        
        if (status !== undefined) {
            updateQuery += `, status = :status`;
            replacements.status = status;
        }
        
        if (recipientType !== undefined) {
            updateQuery += `, recipient_type = :recipientType`;
            replacements.recipientType = recipientType;
        }
        
        updateQuery += ` WHERE id = :notificationId RETURNING *`;
        
        // Ejecutar la actualización
        const [updatedNotification] = await sequelize.query(updateQuery, { 
            replacements,
            plain: true
        });
        
        res.json({
            success: true,
            message: 'Notificación actualizada correctamente',
            notification: updatedNotification
        });
    } catch (error) {
        logger.exception(error, 'Error al actualizar notificación');
        res.status(500).json({ error: 'Error al actualizar notificación', details: error.message });
    }
});

// Eliminar una notificación
router.delete('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        // Verificar si la notificación existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.scheduled_notifications WHERE id = :notificationId`;
        const [existingNotification] = await sequelize.query(checkQuery, { 
            replacements: { notificationId },
            plain: true
        });
        
        if (!existingNotification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        // Verificar si la notificación ya fue enviada
        const checkStatusQuery = `SELECT status FROM notif_eventos_bot.scheduled_notifications WHERE id = :notificationId`;
        const [notificationStatus] = await sequelize.query(checkStatusQuery, { 
            replacements: { notificationId },
            plain: true
        });
        
        if (notificationStatus.status === 'sent') {
            return res.status(400).json({ error: 'No se puede eliminar una notificación que ya ha sido enviada' });
        }
        
        // Eliminar la notificación
        const deleteQuery = `DELETE FROM notif_eventos_bot.scheduled_notifications WHERE id = :notificationId`;
        await sequelize.query(deleteQuery, { replacements: { notificationId } });
        
        res.json({
            success: true,
            message: 'Notificación eliminada correctamente',
            id: notificationId
        });
    } catch (error) {
        logger.exception(error, 'Error al eliminar notificación');
        res.status(500).json({ error: 'Error al eliminar notificación', details: error.message });
    }
});

// Obtener estadísticas de notificaciones para un evento
router.get('/stats/:eventId', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        
        if (!notificationService) {
            return res.status(500).json({ error: 'Servicio de notificaciones no disponible' });
        }
        
        // Obtener estadísticas
        const stats = await notificationService.getEventNotificationStats(eventId);
        
        res.json(stats);
    } catch (error) {
        logger.exception(error, 'Error al obtener estadísticas de notificaciones');
        res.status(500).json({ error: 'Error al obtener estadísticas de notificaciones', details: error.message });
    }
});

module.exports = router; 