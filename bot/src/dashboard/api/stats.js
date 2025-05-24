const express = require('express');
const router = express.Router();
const { sequelize } = require('./db');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../../utils/logger');

// Estadísticas generales del sistema
router.get('/', authenticateToken, async (req, res) => {
    try {
        logger.stats('Iniciando cálculo de estadísticas generales');
        
        let response = {};
        
        try {
            // Estadísticas de eventos
            logger.stats('Consultando estadísticas de eventos');
            const [eventStats] = await sequelize.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled
                FROM events
            `);
            logger.stats('Resultado eventos:', eventStats[0]);
            response.events = eventStats[0];
        } catch (eventError) {
            logger.exception(eventError, 'Error al obtener estadísticas de eventos');
            response.events = { error: eventError.message };
        }
        
        try {
            // Estadísticas de participantes
            logger.stats('Consultando estadísticas de participantes');
            const [participantStats] = await sequelize.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive
                FROM participants
            `);
            logger.stats('Resultado participantes:', participantStats[0]);
            response.participants = participantStats[0];
        } catch (participantError) {
            logger.exception(participantError, 'Error al obtener estadísticas de participantes');
            response.participants = { error: participantError.message };
        }
        
        try {
            // Estadísticas de asistencias
            logger.stats('Consultando estadísticas de asistencias');
            const [attendanceStats] = await sequelize.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN method = 'bot' THEN 1 END) as by_bot,
                    COUNT(CASE WHEN method = 'web' THEN 1 END) as by_web,
                    COUNT(CASE WHEN method = 'admin' THEN 1 END) as by_admin
                FROM attendances
            `);
            logger.stats('Resultado asistencias:', attendanceStats[0]);
            response.attendances = attendanceStats[0];
        } catch (attendanceError) {
            logger.exception(attendanceError, 'Error al obtener estadísticas de asistencias');
            response.attendances = { error: attendanceError.message };
        }
        
        try {
            // Últimos 7 días de asistencias
            logger.stats('Consultando asistencias por día (7 días)');
            const [dailyStats] = await sequelize.query(`
                SELECT 
                    DATE(registration_date) as date,
                    COUNT(*) as count
                FROM attendances
                WHERE registration_date >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY DATE(registration_date)
                ORDER BY date DESC
            `);
            logger.stats('Resultado asistencias diarias:', dailyStats);
            response.daily = dailyStats;
        } catch (dailyError) {
            logger.exception(dailyError, 'Error al obtener estadísticas diarias');
            response.daily = { error: dailyError.message };
        }
        
        try {
            // Agrupar asistencias por evento (Top 5)
            logger.stats('Consultando asistencias por evento (Top 5)');
            const [eventAttendanceStats] = await sequelize.query(`
                SELECT 
                    e.id,
                    e.name,
                    COUNT(a.id) as attendances_count
                FROM events e
                LEFT JOIN attendances a ON e.id = a.event_id
                GROUP BY e.id, e.name
                ORDER BY attendances_count DESC
                LIMIT 5
            `);
            logger.stats('Resultado asistencias por evento:', eventAttendanceStats);
            response.topEvents = eventAttendanceStats;
        } catch (topEventsError) {
            logger.exception(topEventsError, 'Error al obtener estadísticas de eventos top');
            response.topEvents = { error: topEventsError.message };
        }
        
        res.json(response);
    } catch (error) {
        logger.exception(error, 'Error general al calcular estadísticas');
        res.status(500).json({ 
            error: 'Error al calcular estadísticas', 
            details: error.message,
            errorType: error.name,
            errorCode: error.code 
        });
    }
});

module.exports = router; 