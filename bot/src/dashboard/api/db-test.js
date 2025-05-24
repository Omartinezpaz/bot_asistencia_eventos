const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { sequelize, Sequelize, Op } = require('./db');

// Endpoint para probar la conexión a la base de datos
router.get('/test', async (req, res) => {
    try {
        console.log('Probando conexión a la base de datos...');
        
        // Verificar conexión
        await sequelize.authenticate();
        console.log('Conexión establecida con éxito.');
        
        // Listar tablas disponibles
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public'
        `);
        
        // Listar estructura de tabla attendances
        let attendancesStructure = [];
        try {
            [attendancesStructure] = await sequelize.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'attendances'
            `);
        } catch (tableError) {
            console.error('Error al obtener estructura de attendances:', tableError);
            attendancesStructure = [{error: tableError.message}];
        }
        
        res.json({
            connection: 'success',
            tables: tables.map(t => t.table_name),
            attendancesStructure
        });
    } catch (error) {
        console.error('Error al probar la conexión:', error);
        res.status(500).json({
            connection: 'failed',
            error: error.message
        });
    }
});

// Endpoint para probar datos de la tabla attendances
router.get('/attendances-test', async (req, res) => {
    try {
        console.log('Probando consulta básica en attendances...');
        
        // Intenta contar registros en attendances
        const countQuery = `SELECT COUNT(*) FROM attendances`;
        
        try {
            const [countResult] = await sequelize.query(countQuery, { plain: true });
            
            // Si llegamos aquí, la tabla existe, intentemos obtener algunos registros
            let sampleData = [];
            if (parseInt(countResult.count) > 0) {
                const sampleQuery = `
                    SELECT id, participant_id, event_id, status, registration_date 
                    FROM attendances 
                    LIMIT 5
                `;
                [sampleData] = await sequelize.query(sampleQuery);
            }
            
            res.json({
                exists: true,
                count: parseInt(countResult.count),
                sample: sampleData
            });
        } catch (queryError) {
            console.error('Error al consultar attendances:', queryError);
            
            // Intentar determinar si la tabla existe
            const [tablesResult] = await sequelize.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'attendances'
                ) as exists
            `, { plain: true });
            
            res.status(500).json({
                exists: tablesResult.exists,
                error: queryError.message
            });
        }
    } catch (error) {
        console.error('Error general en test de attendances:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router; 