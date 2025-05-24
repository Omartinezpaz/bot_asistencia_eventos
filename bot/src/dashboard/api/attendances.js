const express = require('express');
const router = express.Router();
const { authenticateToken, checkAdminRole } = require('../middleware/auth');
const { sequelize } = require('./db');
const logger = require('../../utils/logger');
const { Participante, RegistroElectoral, CentroVotacion, Geografia } = require('../../database');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configurar multer para importaciones
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../../uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, `import-${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos CSV'));
        }
    }
});

// Obtener lista de asistencias paginada
router.get('/', authenticateToken, async (req, res) => {
    try {
        logger.api('Iniciando obtención de asistencias');
        logger.api('Parámetros:', req.query);
        logger.api('Usuario:', req.user?.id);
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const searchTerm = req.query.search || '';
        const eventId = req.query.eventId || null;
        
        logger.api('Parámetros procesados:', { page, limit, offset, searchTerm, eventId });
        
        // Construir la consulta base con JOINS para obtener información relacionada
        let query = `
            SELECT 
                a.id,
                a.status,
                a.registeredat as registration_date,
                a.method,
                a.location,
                a.notes,
                p.id as participant_id,
                p.firstname || ' ' || p.lastname as participant_name,
                p.nac || p.cedula as participant_document,
                e.id as event_id,
                e.name as event_name,
                e.date as event_date
            FROM notif_eventos_bot.attendances a
            JOIN notif_eventos_bot.participants p ON a.participantid = p.id
            JOIN notif_eventos_bot.events e ON a.eventid = e.id
            WHERE 1=1
        `;
        
        logger.api('Query base construida');
        
        // Añadir condiciones de filtrado
        const replacements = {};
        
        if (searchTerm) {
            query += ` AND (
                p.firstname ILIKE :searchTerm OR
                p.lastname ILIKE :searchTerm OR
                p.cedula LIKE :searchTermExact OR
                p.nac || p.cedula LIKE :searchTermExact
            )`;
            replacements.searchTerm = `%${searchTerm}%`;
            replacements.searchTermExact = `%${searchTerm}%`;
        }
        
        if (eventId) {
            query += ` AND a.eventid = :eventId`;
            replacements.eventId = eventId;
        }
        
        // Añadir ordenamiento
        query += ` ORDER BY a.registration_date DESC`;
        
        logger.api('Condiciones de filtrado añadidas');
        logger.api('Reemplazos:', replacements);
        
        // Consulta para contar el total de registros (para paginación)
        const countQuery = `
            SELECT COUNT(*) FROM (${query}) as subquery
        `;
        
        // Añadir paginación
        query += ` LIMIT :limit OFFSET :offset`;
        replacements.limit = limit;
        replacements.offset = offset;
        
        logger.api('Ejecutando consultas...');
        logger.debug('Query final:', query);
        
        try {
            // Ejecutar las consultas
            logger.api('Ejecutando consulta principal');
            const [attendances] = await sequelize.query(query, { replacements });
            logger.api(`Consulta principal completada, ${attendances?.length || 0} resultados`);
            
            logger.api('Ejecutando consulta de conteo');
            const [countResult] = await sequelize.query(countQuery, { replacements, plain: true });
            logger.api('Consulta de conteo completada:', countResult);
            
            const totalItems = parseInt(countResult?.count || 0);
            const totalPages = Math.ceil(totalItems / limit);
            
            // Formatear los datos para la respuesta
            const formattedAttendances = attendances.map(attendance => ({
                id: attendance.id,
                participant: {
                    id: attendance.participant_id,
                    name: attendance.participant_name,
                    document: attendance.participant_document
                },
                event: {
                    id: attendance.event_id,
                    name: attendance.event_name,
                    date: attendance.event_date
                },
                registrationDate: attendance.registration_date,
                method: attendance.method,
                location: attendance.location,
                status: attendance.status,
                notes: attendance.notes
            }));
            
            logger.api('Respuesta preparada, enviando...');
            res.json({
                items: formattedAttendances,
                pagination: {
                    page,
                    limit,
                    totalItems,
                    totalPages
                }
            });
        } catch (queryError) {
            logger.exception(queryError, 'Error en las consultas SQL de asistencias');
            logger.error('Query con error:', query.replace(/\s+/g, ' ').trim());
            logger.error('Reemplazos:', replacements);
            
            res.status(500).json({ 
                error: 'Error en las consultas de base de datos', 
                details: queryError.message,
                query: query.replace(/\s+/g, ' ').trim().substring(0, 200) + '...',
                errorType: queryError.name,
                errorCode: queryError.code
            });
        }
    } catch (error) {
        logger.exception(error, 'Error general al obtener asistencias');
        
        res.status(500).json({ 
            error: 'Error al obtener asistencias', 
            details: error.message,
            errorType: error.name,
            errorCode: error.code 
        });
    }
});

// Obtener resumen de asistencias por evento
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                e.id as event_id,
                e.name as event_name,
                e.date as event_date,
                COUNT(a.id) as total_attendances,
                SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_attendances,
                SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_attendances,
                CASE 
                    WHEN COUNT(a.id) > 0 THEN 
                        ROUND((SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END)::numeric / COUNT(a.id)::numeric) * 100, 2)
                    ELSE 0
                END AS attendance_rate
            FROM events e
            LEFT JOIN attendances a ON e.id = a.eventid
            GROUP BY e.id, e.name, e.date
            ORDER BY e.date DESC
        `;
        
        const [results] = await sequelize.query(query);
        
        res.json(results);
    } catch (error) {
        console.error('Error al obtener resumen de asistencias:', error);
        res.status(500).json({ error: 'Error al obtener resumen de asistencias' });
    }
});

// Obtener detalle de una asistencia
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const attendanceId = req.params.id;
        
        const query = `
            SELECT 
                a.id,
                a.status,
                a.registeredat as registration_date,
                a.method,
                a.location,
                a.notes,
                p.id as participant_id,
                p.firstname as participant_first_name,
                p.lastname as participant_last_name,
                p.nac as participant_nac,
                p.cedula as participant_cedula,
                p.telegramid as participant_telegram_id,
                o.name as participant_organization,
                e.id as event_id,
                e.name as event_name,
                e.date as event_date,
                e.location as event_location,
                eo.name as event_organization
            FROM notif_eventos_bot.attendances a
            JOIN notif_eventos_bot.participants p ON a.participantid = p.id
            LEFT JOIN notif_eventos_bot.organizations o ON p.organization_id = o.id
            JOIN notif_eventos_bot.events e ON a.eventid = e.id
            LEFT JOIN notif_eventos_bot.organizations eo ON e.organization_id = eo.id
            WHERE a.id = :attendanceId
        `;
        
        const [results] = await sequelize.query(query, { 
            replacements: { attendanceId }, 
            plain: true 
        });
        
        if (!results) {
            return res.status(404).json({ error: 'Asistencia no encontrada' });
        }
        
        // Formatear la respuesta
        const attendance = {
            id: results.id,
            participant: {
                id: results.participant_id,
                firstName: results.participant_first_name,
                lastName: results.participant_last_name,
                document: results.participant_nac + results.participant_cedula,
                telegramId: results.participant_telegram_id,
                organization: results.participant_organization
            },
            event: {
                id: results.event_id,
                name: results.event_name,
                date: results.event_date,
                location: results.event_location,
                organization: results.event_organization
            },
            registrationDate: results.registration_date,
            method: results.method,
            location: results.location,
            status: results.status,
            notes: results.notes
        };
        
        res.json(attendance);
    } catch (error) {
        console.error('Error al obtener detalles de asistencia:', error);
        res.status(500).json({ error: 'Error al obtener detalles de asistencia' });
    }
});

// Crear una nueva asistencia
router.post('/', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { participantId, eventId, registrationDate, method, location, status, notes } = req.body;
        
        // Validar datos obligatorios
        if (!participantId || !eventId) {
            return res.status(400).json({ error: 'Participante y evento son obligatorios' });
        }
        
        // Verificar si ya existe una asistencia para este participante y evento
        const checkQuery = `
            SELECT id FROM notif_eventos_bot.attendances 
            WHERE participantid = :participantId AND eventid = :eventId
        `;
        
        const [existingAttendance] = await sequelize.query(checkQuery, { 
            replacements: { participantId, eventId },
            plain: true
        });
        
        if (existingAttendance) {
            return res.status(400).json({ 
                error: 'Ya existe una asistencia registrada para este participante en este evento',
                attendanceId: existingAttendance.id
            });
        }
        
        // Insertar nueva asistencia
        const insertQuery = `
            INSERT INTO notif_eventos_bot.attendances (
                participantid, 
                eventid, 
                registeredat, 
                method, 
                location, 
                status, 
                notes,
                createdat,
                updatedat
            ) VALUES (
                :participantId, 
                :eventId, 
                :registrationDate, 
                :method, 
                :location, 
                :status, 
                :notes,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;
        
        const [result] = await sequelize.query(insertQuery, { 
            replacements: { 
                participantId, 
                eventId, 
                registrationDate: registrationDate || new Date(),
                method: method || 'manual',
                location: location || null,
                status: status || 'confirmed',
                notes: notes || null
            },
            plain: true
        });
        
        res.status(201).json({
            id: result.id,
            participantId,
            eventId,
            registrationDate,
            method,
            location,
            status,
            notes,
            created: true
        });
    } catch (error) {
        console.error('Error al crear asistencia:', error);
        res.status(500).json({ error: 'Error al crear asistencia', details: error.message });
    }
});

// Actualizar una asistencia existente
router.put('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const attendanceId = req.params.id;
        const { participantId, eventId, registrationDate, method, location, status, notes } = req.body;
        
        // Validar datos obligatorios
        if (!participantId || !eventId) {
            return res.status(400).json({ error: 'Participante y evento son obligatorios' });
        }
        
        // Verificar si la asistencia existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.attendances WHERE id = :attendanceId`;
        const [existingAttendance] = await sequelize.query(checkQuery, { 
            replacements: { attendanceId },
            plain: true
        });
        
        if (!existingAttendance) {
            return res.status(404).json({ error: 'Asistencia no encontrada' });
        }
        
        // Actualizar asistencia
        const updateQuery = `
            UPDATE notif_eventos_bot.attendances SET
                participantid = :participantId,
                eventid = :eventId,
                registeredat = :registrationDate,
                method = :method,
                location = :location,
                status = :status,
                notes = :notes,
                updatedat = CURRENT_TIMESTAMP
            WHERE id = :attendanceId
        `;
        
        await sequelize.query(updateQuery, { 
            replacements: { 
                attendanceId,
                participantId, 
                eventId, 
                registrationDate: registrationDate || new Date(),
                method: method || 'manual',
                location: location || null,
                status: status || 'confirmed',
                notes: notes || null
            }
        });
        
        res.json({
            id: attendanceId,
            participantId,
            eventId,
            registrationDate,
            method,
            location,
            status,
            notes,
            updated: true
        });
    } catch (error) {
        console.error('Error al actualizar asistencia:', error);
        res.status(500).json({ error: 'Error al actualizar asistencia' });
    }
});

// Eliminar una asistencia
router.delete('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const attendanceId = req.params.id;
        
        // Verificar si la asistencia existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.attendances WHERE id = :attendanceId`;
        const [existingAttendance] = await sequelize.query(checkQuery, { 
            replacements: { attendanceId },
            plain: true
        });
        
        if (!existingAttendance) {
            return res.status(404).json({ error: 'Asistencia no encontrada' });
        }
        
        // Eliminar asistencia
        const deleteQuery = `DELETE FROM notif_eventos_bot.attendances WHERE id = :attendanceId`;
        await sequelize.query(deleteQuery, { replacements: { attendanceId } });
        
        res.json({
            id: attendanceId,
            deleted: true
        });
    } catch (error) {
        console.error('Error al eliminar asistencia:', error);
        res.status(500).json({ error: 'Error al eliminar asistencia' });
    }
});

// Validar participante para asistencia
router.post('/validate-participant', authenticateToken, async (req, res) => {
    try {
        const { cedula, eventId, nac } = req.body;
        
        // Validar datos obligatorios
        if (!cedula) {
            return res.status(400).json({ error: 'La cédula es obligatoria' });
        }
        
        if (!eventId) {
            return res.status(400).json({ error: 'El ID del evento es obligatorio' });
        }
        
        // Buscar participante por cédula
        const nacionalidad = nac || 'V'; // Valor por defecto
        
        const participantQuery = `
            SELECT 
                p.id, 
                p.firstname, 
                p.lastname, 
                p.nac, 
                p.cedula,
                p.email,
                p.phone,
                o.name as organization_name
            FROM notif_eventos_bot.participants p
            LEFT JOIN notif_eventos_bot.organizations o ON p.organization_id = o.id
            WHERE p.cedula = :cedula AND p.nac = :nacionalidad
        `;
        
        const [participante] = await sequelize.query(participantQuery, { 
            replacements: { cedula, nacionalidad },
            plain: true
        });
        
        // Verificar si ya existe una asistencia para este participante y evento
        let asistenciaExistente = null;
        
        if (participante) {
            const checkQuery = `
                SELECT 
                    a.id, 
                    a.status, 
                    a.registeredat,
                    a.method
                FROM notif_eventos_bot.attendances a
                WHERE a.participantid = :participantId AND a.eventid = :eventId
            `;
            
            [asistenciaExistente] = await sequelize.query(checkQuery, { 
                replacements: { participantId: participante.id, eventId },
                plain: true
            });
        }
        
        // Buscar en el registro electoral si no se encuentra participante
        let registroElectoral = null;
        let centroVotacion = null;
        
        if (!participante) {
            try {
                // Buscar en el registro electoral
                registroElectoral = await RegistroElectoral.findOne({
                    where: { cedula, nac: nacionalidad },
                    include: [{
                        model: CentroVotacion,
                        required: false
                    }]
                });
                
                if (registroElectoral && registroElectoral.CentroVotacion) {
                    centroVotacion = {
                        codigo: registroElectoral.cod_centrov,
                        nombre: registroElectoral.CentroVotacion.nom_centro,
                        direccion: registroElectoral.CentroVotacion.direccion
                    };
                }
            } catch (error) {
                console.error('Error al buscar en registro electoral:', error);
                // No detenemos el proceso si falla la búsqueda en registro electoral
            }
        }
        
        // Obtener información del evento
        const eventQuery = `
            SELECT 
                e.id, 
                e.name, 
                e.date, 
                e.location,
                e.description
            FROM notif_eventos_bot.events e
            WHERE e.id = :eventId
        `;
        
        const [evento] = await sequelize.query(eventQuery, { 
            replacements: { eventId },
            plain: true
        });
        
        if (!evento) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Preparar respuesta
        const response = {
            participante: participante ? {
                id: participante.id,
                nombreCompleto: `${participante.firstname} ${participante.lastname}`,
                documento: `${participante.nac}${participante.cedula}`,
                organizacion: participante.organization_name,
                email: participante.email,
                phone: participante.phone,
                faltanDatos: !participante.email || !participante.phone
            } : null,
            registroElectoral: registroElectoral ? {
                nombreCompleto: `${registroElectoral.p_nombre || ''} ${registroElectoral.s_nombre || ''} ${registroElectoral.p_apellido || ''} ${registroElectoral.s_apellido || ''}`.replace(/\s+/g, ' ').trim(),
                documento: `${registroElectoral.nac}${registroElectoral.cedula}`,
                centroVotacion
            } : null,
            evento: {
                id: evento.id,
                nombre: evento.name,
                fecha: evento.date,
                ubicacion: evento.location,
                descripcion: evento.description
            },
            asistencia: asistenciaExistente ? {
                id: asistenciaExistente.id,
                estado: asistenciaExistente.status,
                fechaRegistro: asistenciaExistente.registeredat,
                metodo: asistenciaExistente.method,
                yaRegistrado: true
            } : null,
            puedeRegistrar: !!participante && !asistenciaExistente,
            requiereCrearParticipante: !participante && !!registroElectoral,
            noEncontrado: !participante && !registroElectoral
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error al validar participante:', error);
        res.status(500).json({ error: 'Error al validar participante', details: error.message });
    }
});

// Endpoint de prueba para validar participante sin autenticación (solo en desarrollo)
router.post('/validate-participant-test', async (req, res) => {
    try {
        const { cedula, eventId, nac } = req.body;
        
        // Validar datos obligatorios
        if (!cedula) {
            return res.status(400).json({ error: 'La cédula es obligatoria' });
        }
        
        if (!eventId) {
            return res.status(400).json({ error: 'El ID del evento es obligatorio' });
        }
        
        // Buscar participante por cédula
        const nacionalidad = nac || 'V'; // Valor por defecto
        
        const participantQuery = `
            SELECT 
                p.id, 
                p.firstname, 
                p.lastname, 
                p.nac, 
                p.cedula,
                p.email,
                p.phone,
                o.name as organization_name
            FROM notif_eventos_bot.participants p
            LEFT JOIN notif_eventos_bot.organizations o ON p.organization_id = o.id
            WHERE p.cedula = :cedula AND p.nac = :nacionalidad
        `;
        
        const [participante] = await sequelize.query(participantQuery, { 
            replacements: { cedula, nacionalidad },
            plain: true
        });
        
        // Verificar si ya existe una asistencia para este participante y evento
        let asistenciaExistente = null;
        
        if (participante) {
            const checkQuery = `
                SELECT 
                    a.id, 
                    a.status, 
                    a.registeredat,
                    a.method
                FROM notif_eventos_bot.attendances a
                WHERE a.participantid = :participantId AND a.eventid = :eventId
            `;
            
            [asistenciaExistente] = await sequelize.query(checkQuery, { 
                replacements: { participantId: participante.id, eventId },
                plain: true
            });
        }
        
        // Buscar en el registro electoral si no se encuentra participante
        let registroElectoral = null;
        let centroVotacion = null;
        
        if (!participante) {
            try {
                // Buscar en el registro electoral
                registroElectoral = await RegistroElectoral.findOne({
                    where: { cedula, nac: nacionalidad },
                    include: [{
                        model: CentroVotacion,
                        required: false
                    }]
                });
                
                if (registroElectoral && registroElectoral.CentroVotacion) {
                    centroVotacion = {
                        codigo: registroElectoral.cod_centrov,
                        nombre: registroElectoral.CentroVotacion.nom_centro,
                        direccion: registroElectoral.CentroVotacion.direccion
                    };
                }
            } catch (error) {
                console.error('Error al buscar en registro electoral:', error);
                // No detenemos el proceso si falla la búsqueda en registro electoral
            }
        }
        
        // Obtener información del evento
        const eventQuery = `
            SELECT 
                e.id, 
                e.name, 
                e.date, 
                e.location,
                e.description
            FROM notif_eventos_bot.events e
            WHERE e.id = :eventId
        `;
        
        const [evento] = await sequelize.query(eventQuery, { 
            replacements: { eventId },
            plain: true
        });
        
        if (!evento) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        // Preparar respuesta
        const response = {
            participante: participante ? {
                id: participante.id,
                nombreCompleto: `${participante.firstname} ${participante.lastname}`,
                documento: `${participante.nac}${participante.cedula}`,
                organizacion: participante.organization_name,
                email: participante.email,
                phone: participante.phone,
                faltanDatos: !participante.email || !participante.phone
            } : null,
            registroElectoral: registroElectoral ? {
                nombreCompleto: `${registroElectoral.p_nombre || ''} ${registroElectoral.s_nombre || ''} ${registroElectoral.p_apellido || ''} ${registroElectoral.s_apellido || ''}`.replace(/\s+/g, ' ').trim(),
                documento: `${registroElectoral.nac}${registroElectoral.cedula}`,
                centroVotacion
            } : null,
            evento: {
                id: evento.id,
                nombre: evento.name,
                fecha: evento.date,
                ubicacion: evento.location,
                descripcion: evento.description
            },
            asistencia: asistenciaExistente ? {
                id: asistenciaExistente.id,
                estado: asistenciaExistente.status,
                fechaRegistro: asistenciaExistente.registeredat,
                metodo: asistenciaExistente.method,
                yaRegistrado: true
            } : null,
            puedeRegistrar: !!participante && !asistenciaExistente,
            requiereCrearParticipante: !participante && !!registroElectoral,
            noEncontrado: !participante && !registroElectoral
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error al validar participante (test):', error);
        res.status(500).json({ error: 'Error al validar participante', details: error.message });
    }
});

// Importar asistencias desde archivo CSV
router.post('/import', authenticateToken, checkAdminRole, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
        }
        
        const { eventId } = req.body;
        
        if (!eventId) {
            return res.status(400).json({ error: 'El ID del evento es obligatorio' });
        }
        
        // Verificar que el evento existe
        const eventQuery = `SELECT id FROM notif_eventos_bot.events WHERE id = :eventId`;
        const [eventExists] = await sequelize.query(eventQuery, { 
            replacements: { eventId },
            plain: true
        });
        
        if (!eventExists) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        
        const filePath = req.file.path;
        const results = [];
        const errors = [];
        let processed = 0;
        let created = 0;
        let skipped = 0;
        let alreadyExists = 0;
        
        // Procesar el archivo CSV
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv({
                    separator: ',',
                    mapHeaders: ({ header }) => header.toLowerCase().trim()
                }))
                .on('data', async (data) => {
                    processed++;
                    
                    // Campos esperados: documento (nacionalidad+cedula), nombre (opcional), apellido (opcional), 
                    // estatus (opcional), notas (opcional), ubicacion (opcional), metodo (opcional)
                    let documento = data.documento || data.cedula || '';
                    let nac = 'V';
                    let cedula = documento;
                    
                    // Separar nacionalidad y cédula
                    if (documento && (documento.startsWith('V') || documento.startsWith('E'))) {
                        nac = documento.charAt(0);
                        cedula = documento.substring(1);
                    }
                    
                    // Buscar participante por cédula
                    try {
                        const participantQuery = `
                            SELECT id FROM notif_eventos_bot.participants
                            WHERE cedula = :cedula AND nac = :nac
                        `;
                        
                        const [participante] = await sequelize.query(participantQuery, { 
                            replacements: { cedula, nac },
                            plain: true
                        });
                        
                        if (!participante) {
                            errors.push({
                                documento,
                                error: 'Participante no encontrado',
                                linea: processed
                            });
                            skipped++;
                            return;
                        }
                        
                        // Verificar si ya existe asistencia
                        const checkQuery = `
                            SELECT id FROM notif_eventos_bot.attendances
                            WHERE participantid = :participantId AND eventid = :eventId
                        `;
                        
                        const [existingAttendance] = await sequelize.query(checkQuery, { 
                            replacements: { participantId: participante.id, eventId },
                            plain: true
                        });
                        
                        if (existingAttendance) {
                            results.push({
                                documento,
                                participanteId: participante.id,
                                asistenciaId: existingAttendance.id,
                                mensaje: 'Asistencia ya registrada',
                                linea: processed
                            });
                            alreadyExists++;
                            return;
                        }
                        
                        // Crear nueva asistencia
                        const insertQuery = `
                            INSERT INTO notif_eventos_bot.attendances (
                                participantid, 
                                eventid, 
                                registeredat, 
                                method, 
                                location, 
                                status, 
                                notes,
                                createdat,
                                updatedat
                            ) VALUES (
                                :participantId, 
                                :eventId, 
                                CURRENT_TIMESTAMP, 
                                :method, 
                                :location, 
                                :status, 
                                :notes,
                                CURRENT_TIMESTAMP,
                                CURRENT_TIMESTAMP
                            ) RETURNING id
                        `;
                        
                        const [result] = await sequelize.query(insertQuery, { 
                            replacements: { 
                                participantId: participante.id,
                                eventId,
                                method: data.metodo || 'import',
                                location: data.ubicacion || null,
                                status: data.estatus || 'confirmed',
                                notes: data.notas || `Importado desde CSV el ${new Date().toISOString()}`
                            },
                            plain: true
                        });
                        
                        results.push({
                            documento,
                            participanteId: participante.id,
                            asistenciaId: result.id,
                            mensaje: 'Asistencia creada exitosamente',
                            linea: processed
                        });
                        created++;
                    } catch (error) {
                        console.error(`Error al procesar línea ${processed}:`, error);
                        errors.push({
                            documento,
                            error: error.message,
                            linea: processed
                        });
                        skipped++;
                    }
                })
                .on('end', () => {
                    // Eliminar el archivo temporal
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Error al eliminar archivo temporal:', err);
                    });
                    
                    resolve();
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
        
        res.json({
            success: true,
            mensaje: `Proceso completado. Se procesaron ${processed} registros.`,
            estadisticas: {
                procesados: processed,
                creados: created,
                omitidos: skipped,
                yaExistentes: alreadyExists
            },
            resultados: results.slice(0, 100), // Limitamos a 100 por rendimiento
            errores: errors.slice(0, 100)  // Limitamos a 100 por rendimiento
        });
    } catch (error) {
        console.error('Error al importar asistencias:', error);
        
        // Eliminar el archivo temporal si existe
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error al eliminar archivo temporal:', err);
            });
        }
        
        res.status(500).json({ error: 'Error al importar asistencias', details: error.message });
    }
});

module.exports = router; 