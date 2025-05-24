const express = require('express');
const router = express.Router();
const { authenticateToken, checkAdminRole } = require('../middleware/auth');
const { sequelize, Sequelize, Op } = require('./db');
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
        cb(null, `import-participants-${Date.now()}-${file.originalname}`);
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

// Obtener lista de participantes paginada
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
                p.id,
                p.nac,
                p.cedula,
                p.firstname,
                p.lastname,
                p.telegramid,
                p.email,
                p.phone,
                p.photo_url,
                p.user_role,
                o.id as organization_id,
                o.name as organization_name
            FROM notif_eventos_bot.participants p
            LEFT JOIN organizations o ON p.organization_id = o.id
            WHERE 1=1
        `;
        
        // Añadir condiciones de filtrado
        const replacements = {};
        
        if (searchTerm) {
            query += ` AND (
                p.firstname ILIKE :searchTerm OR 
                p.lastname ILIKE :searchTerm OR 
                p.cedula LIKE :searchTermExact OR
                p.nac || p.cedula LIKE :searchTermExact OR
                CAST(p.telegramid AS TEXT) LIKE :searchTermExact
            )`;
            replacements.searchTerm = `%${searchTerm}%`;
            replacements.searchTermExact = `%${searchTerm}%`;
        }
        
        if (organizationId) {
            query += ` AND p.organization_id = :organizationId`;
            replacements.organizationId = organizationId;
        }
        
        // Añadir ordenamiento
        query += ` ORDER BY p.lastname, p.firstname`;
        
        // Consulta para contar el total de registros (para paginación)
        const countQuery = `
            SELECT COUNT(*) FROM (${query}) as subquery
        `;
        
        // Añadir paginación
        query += ` LIMIT :limit OFFSET :offset`;
        replacements.limit = limit;
        replacements.offset = offset;
        
        // Ejecutar las consultas
        const [participants] = await sequelize.query(query, { replacements });
        const [countResult] = await sequelize.query(countQuery, { replacements, plain: true });
        
        const totalItems = parseInt(countResult.count);
        const totalPages = Math.ceil(totalItems / limit);
        
        res.json({
            items: participants,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages
            }
        });
    } catch (error) {
        console.error('Error al obtener participantes:', error);
        res.status(500).json({ error: 'Error al obtener participantes', details: error.message });
    }
});

// Obtener lista de participantes para dropdown (selects)
router.get('/dropdown', authenticateToken, async (req, res) => {
    try {
        const organizationId = req.query.organizationId || null;
        const eventId = req.query.eventId || null;
        
        let query = `
            SELECT 
                p.id, 
                p.nac || p.cedula as document,
                p.firstname || ' ' || p.lastname as name,
                p.telegramid
            FROM notif_eventos_bot.participants p
            WHERE 1=1
        `;
        
        const replacements = {};
        
        if (organizationId) {
            query += ` AND p.organization_id = :organizationId`;
            replacements.organizationId = organizationId;
        }
        
        if (eventId) {
            // Excluir participantes que ya están registrados en el evento
            query += ` AND p.id NOT IN (
                SELECT a.participantid FROM attendances a WHERE a.event_id = :eventId
            )`;
            replacements.eventId = eventId;
        }
        
        query += ` ORDER BY p.lastname, p.firstname`;
        
        const [participants] = await sequelize.query(query, { replacements });
        
        res.json(participants);
    } catch (error) {
        console.error('Error al obtener lista de participantes:', error);
        res.status(500).json({ error: 'Error al obtener lista de participantes' });
    }
});

// Obtener detalle de un participante
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const participantId = req.params.id;
        
        const query = `
            SELECT 
                p.id,
                p.nac,
                p.cedula,
                p.firstname,
                p.lastname,
                p.telegramid,
                p.email,
                p.phone,
                p.photo_url,
                p.user_role,
                p.organization_id,
                o.name as organization_name
            FROM notif_eventos_bot.participants p
            LEFT JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = :participantId
        `;
        
        const [participant] = await sequelize.query(query, { 
            replacements: { participantId }, 
            plain: true 
        });
        
        if (!participant) {
            return res.status(404).json({ error: 'Participante no encontrado' });
        }
        
        res.json(participant);
    } catch (error) {
        console.error('Error al obtener detalles del participante:', error);
        res.status(500).json({ error: 'Error al obtener detalles del participante' });
    }
});

// Funciones de validación
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

const validatePhone = (phone) => {
    // Valida número de teléfono venezolano (04XX-XXX-XXXX o números sin formato)
    const re = /^(0414|0424|0412|0416|0426)[-\s]?[0-9]{3}[-\s]?[0-9]{4}$|^[0-9]{10,11}$/;
    return re.test(phone);
};

const validateCedula = (nac, cedula) => {
    // Validar que la nacionalidad sea V o E
    if (nac !== 'V' && nac !== 'E') {
        return { valid: false, message: 'La nacionalidad debe ser V o E' };
    }
    
    // Validar que la cédula sea un número
    if (!/^\d+$/.test(cedula)) {
        return { valid: false, message: 'La cédula debe contener solo números' };
    }
    
    // Validar longitud entre 6 y 8 dígitos
    if (cedula.length < 6 || cedula.length > 8) {
        return { valid: false, message: 'La cédula debe tener entre 6 y 8 dígitos' };
    }
    
    return { valid: true };
};

// Crear un nuevo participante
router.post('/', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { 
            nac, 
            cedula, 
            firstName, 
            lastName, 
            telegramId, 
            email, 
            phone, 
            photoUrl,
            organizationId, 
            userRole = 'user'
        } = req.body;
        
        // Validar datos obligatorios
        if (!nac || !cedula || !firstName || !lastName) {
            return res.status(400).json({ error: 'Nac, cédula, nombre y apellido son obligatorios' });
        }
        
        // Validar cédula
        const cedulaValidation = validateCedula(nac, cedula);
        if (!cedulaValidation.valid) {
            return res.status(400).json({ error: cedulaValidation.message });
        }
        
        // Validar que teléfono y correo sean obligatorios
        if (!email) {
            return res.status(400).json({ error: 'El correo electrónico es obligatorio' });
        }
        
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'El formato del correo electrónico no es válido' });
        }
        
        if (!phone) {
            return res.status(400).json({ error: 'El número de teléfono es obligatorio' });
        }
        
        if (!validatePhone(phone)) {
            return res.status(400).json({ error: 'El formato del número de teléfono no es válido. Debe ser un número venezolano (ej: 0414-123-4567)' });
        }
        
        // Verificar si ya existe un participante con la misma cédula
        const checkQuery = `
            SELECT id FROM notif_eventos_bot.participants WHERE nac = :nac AND cedula = :cedula
        `;
        
        const [existingParticipant] = await sequelize.query(checkQuery, { 
            replacements: { nac, cedula },
            plain: true 
        });
        
        if (existingParticipant) {
            return res.status(400).json({ error: 'Ya existe un participante con esa cédula' });
        }
        
        // Insertar nuevo participante
        const insertQuery = `
            INSERT INTO notif_eventos_bot.participants (
                nac,
                cedula,
                firstname,
                lastname,
                telegramid,
                email,
                phone,
                photo_url,
                organization_id,
                user_role,
                createdat,
                updatedat
            ) VALUES (
                :nac,
                :cedula,
                :firstName,
                :lastName,
                :telegramId,
                :email,
                :phone,
                :photoUrl,
                :organizationId,
                :userRole,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;
        
        const [result] = await sequelize.query(insertQuery, { 
            replacements: { 
                nac, 
                cedula, 
                firstName, 
                lastName, 
                telegramId: telegramId || null, 
                email: email || null, 
                phone: phone || null, 
                photoUrl: photoUrl || null,
                organizationId: organizationId || null, 
                userRole
            },
            plain: true 
        });
        
        res.status(201).json({
            id: result.id,
            nac,
            cedula,
            firstName,
            lastName,
            telegramId,
            email,
            phone,
            photoUrl,
            organizationId,
            userRole,
            created: true
        });
    } catch (error) {
        console.error('Error al crear participante:', error);
        res.status(500).json({ error: 'Error al crear participante', details: error.message });
    }
});

// Actualizar un participante existente
router.put('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const participantId = req.params.id;
        const { 
            nac, 
            cedula, 
            firstName, 
            lastName, 
            telegramId, 
            email, 
            phone, 
            photoUrl,
            organizationId, 
            userRole
        } = req.body;
        
        // Validar datos obligatorios
        if (!nac || !cedula || !firstName || !lastName) {
            return res.status(400).json({ error: 'Nac, cédula, nombre y apellido son obligatorios' });
        }
        
        // Validar cédula
        const cedulaValidation = validateCedula(nac, cedula);
        if (!cedulaValidation.valid) {
            return res.status(400).json({ error: cedulaValidation.message });
        }
        
        // Validar que teléfono y correo sean obligatorios
        if (!email) {
            return res.status(400).json({ error: 'El correo electrónico es obligatorio' });
        }
        
        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'El formato del correo electrónico no es válido' });
        }
        
        if (!phone) {
            return res.status(400).json({ error: 'El número de teléfono es obligatorio' });
        }
        
        if (!validatePhone(phone)) {
            return res.status(400).json({ error: 'El formato del número de teléfono no es válido. Debe ser un número venezolano (ej: 0414-123-4567)' });
        }
        
        // Verificar si el participante existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.participants WHERE id = :participantId`;
        const [existingParticipant] = await sequelize.query(checkQuery, { 
            replacements: { participantId },
            plain: true 
        });
        
        if (!existingParticipant) {
            return res.status(404).json({ error: 'Participante no encontrado' });
        }
        
        // Verificar si la nueva cédula ya existe (excepto si es el mismo participante)
        const checkCedulaQuery = `
            SELECT id FROM notif_eventos_bot.participants WHERE nac = :nac AND cedula = :cedula AND id != :participantId
        `;
        
        const [duplicateParticipant] = await sequelize.query(checkCedulaQuery, { 
            replacements: { nac, cedula, participantId },
            plain: true 
        });
        
        if (duplicateParticipant) {
            return res.status(400).json({ error: 'Ya existe otro participante con esa cédula' });
        }
        
        // Actualizar participante
        const updateQuery = `
            UPDATE notif_eventos_bot.participants SET
                nac = :nac,
                cedula = :cedula,
                firstname = :firstName,
                lastname = :lastName,
                telegramid = :telegramId,
                email = :email,
                phone = :phone,
                photo_url = :photoUrl,
                organization_id = :organizationId,
                user_role = :userRole,
                updatedat = CURRENT_TIMESTAMP
            WHERE id = :participantId
        `;
        
        await sequelize.query(updateQuery, { 
            replacements: { 
                participantId,
                nac, 
                cedula, 
                firstName, 
                lastName, 
                telegramId: telegramId || null, 
                email: email || null, 
                phone: phone || null, 
                photoUrl: photoUrl || null,
                organizationId: organizationId || null, 
                userRole: userRole || 'user'
            }
        });
        
        res.json({
            id: participantId,
            nac,
            cedula,
            firstName,
            lastName,
            telegramId,
            email,
            phone,
            photoUrl,
            organizationId,
            userRole,
            updated: true
        });
    } catch (error) {
        console.error('Error al actualizar participante:', error);
        res.status(500).json({ error: 'Error al actualizar participante' });
    }
});

// Eliminar un participante
router.delete('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const participantId = req.params.id;
        
        // Verificar si el participante existe
        const checkQuery = `SELECT id FROM notif_eventos_bot.participants WHERE id = :participantId`;
        const [existingParticipant] = await sequelize.query(checkQuery, { 
            replacements: { participantId },
            plain: true 
        });
        
        if (!existingParticipant) {
            return res.status(404).json({ error: 'Participante no encontrado' });
        }
        
        // Verificar referencias en asistencias
        const checkAttendancesQuery = `
            SELECT COUNT(*) as count FROM notif_eventos_bot.attendances WHERE participantid = :participantId
        `;
        
        const [attendancesResult] = await sequelize.query(checkAttendancesQuery, { 
            replacements: { participantId },
            plain: true 
        });
        
        if (attendancesResult.count > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar el participante porque tiene asistencias registradas',
                count: attendancesResult.count
            });
        }
        
        // Eliminar participante
        const deleteQuery = `DELETE FROM notif_eventos_bot.participants WHERE id = :participantId`;
        await sequelize.query(deleteQuery, { replacements: { participantId } });
        
        res.json({
            id: participantId,
            deleted: true
        });
    } catch (error) {
        console.error('Error al eliminar participante:', error);
        res.status(500).json({ error: 'Error al eliminar participante' });
    }
});

// Endpoint de prueba para validar datos sin autenticación (solo en desarrollo)
router.post('/validate-test', async (req, res) => {
    try {
        const { 
            nac, 
            cedula, 
            firstName, 
            lastName, 
            telegramId, 
            email, 
            phone, 
            photoUrl,
            organizationId
        } = req.body;
        
        const errors = [];
        
        // Validar datos obligatorios
        if (!nac || !cedula || !firstName || !lastName) {
            errors.push('Nac, cédula, nombre y apellido son obligatorios');
        }
        
        // Validar cédula
        if (nac && cedula) {
            const cedulaValidation = validateCedula(nac, cedula);
            if (!cedulaValidation.valid) {
                errors.push(cedulaValidation.message);
            }
        }
        
        // Validar que teléfono y correo sean obligatorios
        if (!email) {
            errors.push('El correo electrónico es obligatorio');
        } else if (!validateEmail(email)) {
            errors.push('El formato del correo electrónico no es válido');
        }
        
        if (!phone) {
            errors.push('El número de teléfono es obligatorio');
        } else if (!validatePhone(phone)) {
            errors.push('El formato del número de teléfono no es válido. Debe ser un número venezolano (ej: 0414-123-4567)');
        }
        
        if (errors.length > 0) {
            return res.status(400).json({ 
                valid: false,
                errors 
            });
        }
        
        res.json({
            valid: true,
            data: {
                nac,
                cedula,
                firstName,
                lastName,
                telegramId,
                email,
                phone,
                photoUrl,
                organizationId
            }
        });
    } catch (error) {
        console.error('Error al validar participante:', error);
        res.status(500).json({ error: 'Error al validar participante', details: error.message });
    }
});

// Endpoint sin autenticación para validar si un participante existe por cédula
router.post('/check-participant-test', async (req, res) => {
    try {
        const { cedula, nac = 'V' } = req.body;
        
        if (!cedula) {
            return res.status(400).json({ error: 'La cédula es obligatoria' });
        }
        
        // Validar formato de cédula
        const cedulaValidation = validateCedula(nac, cedula);
        if (!cedulaValidation.valid) {
            return res.status(400).json({ 
                error: cedulaValidation.message,
                exists: false
            });
        }
        
        // Buscar participante en la base de datos
        const query = `
            SELECT 
                p.id,
                p.nac,
                p.cedula,
                p.firstname,
                p.lastname,
                p.telegramid,
                p.email,
                p.phone,
                p.photo_url,
                p.user_role,
                p.organization_id,
                o.name as organization_name
            FROM notif_eventos_bot.participants p
            LEFT JOIN organizations o ON p.organization_id = o.id
            WHERE p.nac = :nac AND p.cedula = :cedula
        `;
        
        const [participant] = await sequelize.query(query, { 
            replacements: { nac, cedula },
            plain: true 
        });
        
        if (!participant) {
            // Si no existe, verificar en el registro electoral
            try {
                const { RegistroElectoral, CentroVotacion } = require('../../database');
                
                const registroElectoral = await RegistroElectoral.findOne({
                    where: { cedula, nac },
                    include: [{
                        model: CentroVotacion,
                        required: false
                    }]
                });
                
                if (registroElectoral) {
                    // Formatear nombre completo
                    const nombreCompleto = `${registroElectoral.p_nombre || ''} ${registroElectoral.s_nombre || ''}`.trim();
                    const apellidoCompleto = `${registroElectoral.p_apellido || ''} ${registroElectoral.s_apellido || ''}`.trim();
                    
                    let centroVotacion = null;
                    if (registroElectoral.CentroVotacion) {
                        centroVotacion = {
                            codigo: registroElectoral.cod_centrov,
                            nombre: registroElectoral.CentroVotacion.nom_centro,
                            direccion: registroElectoral.CentroVotacion.direccion
                        };
                    }
                    
                    return res.json({
                        exists: false,
                        registroElectoral: {
                            cedula: registroElectoral.cedula,
                            nac: registroElectoral.nac,
                            nombre: nombreCompleto,
                            apellido: apellidoCompleto,
                            centroVotacion
                        },
                        requiereCrearParticipante: true
                    });
                }
                
                return res.json({
                    exists: false,
                    message: 'No se encontró ningún participante con esa cédula'
                });
            } catch (error) {
                console.error('Error al buscar en registro electoral:', error);
                return res.json({
                    exists: false,
                    message: 'No se encontró ningún participante con esa cédula'
                });
            }
        }
        
        // Evaluar si faltan datos en el registro
        const faltanDatos = !participant.email || !participant.phone;
        
        res.json({
            exists: true,
            participant: {
                id: participant.id,
                cedula: participant.cedula,
                nac: participant.nac,
                documento: `${participant.nac}${participant.cedula}`,
                firstName: participant.firstname,
                lastName: participant.lastname,
                fullName: `${participant.firstname} ${participant.lastname}`,
                email: participant.email,
                phone: participant.phone,
                telegramId: participant.telegramid,
                organizationId: participant.organization_id,
                organizationName: participant.organization_name
            },
            faltanDatos
        });
    } catch (error) {
        console.error('Error al verificar participante:', error);
        res.status(500).json({ 
            error: 'Error al verificar participante', 
            details: error.message,
            exists: false
        });
    }
});

// Importar participantes desde archivo CSV
router.post('/import', authenticateToken, checkAdminRole, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
        }
        
        const { organizationId } = req.body;
        
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
                    
                    // Campos esperados: documento o nacionalidad+cedula, nombre, apellido, email, telefono, etc.
                    let nac = data.nacionalidad || data.nac || 'V';
                    let cedula = data.cedula;
                    let documento = data.documento;
                    
                    // Separar nacionalidad y cédula si viene en formato documento (V12345678)
                    if (documento && !cedula) {
                        if (documento.startsWith('V') || documento.startsWith('E')) {
                            nac = documento.charAt(0);
                            cedula = documento.substring(1);
                        } else {
                            cedula = documento;
                        }
                    }
                    
                    const firstName = data.nombre || data.firstname || '';
                    const lastName = data.apellido || data.lastname || '';
                    const email = data.email || data.correo || '';
                    const phone = data.telefono || data.phone || '';
                    const telegramId = data.telegramid || '';
                    
                    // Validar datos obligatorios
                    if (!nac || !cedula || !firstName || !lastName) {
                        errors.push({
                            documento: documento || `${nac}${cedula}`,
                            error: 'Faltan datos obligatorios (nacionalidad, cédula, nombre o apellido)',
                            linea: processed
                        });
                        skipped++;
                        return;
                    }
                    
                    // Validar cédula
                    const cedulaValidation = validateCedula(nac, cedula);
                    if (!cedulaValidation.valid) {
                        errors.push({
                            documento: `${nac}${cedula}`,
                            error: cedulaValidation.message,
                            linea: processed
                        });
                        skipped++;
                        return;
                    }
                    
                    // Validar email si está presente
                    if (email && !validateEmail(email)) {
                        errors.push({
                            documento: `${nac}${cedula}`,
                            error: 'El formato del correo electrónico no es válido',
                            linea: processed
                        });
                        skipped++;
                        return;
                    }
                    
                    // Validar teléfono si está presente
                    if (phone && !validatePhone(phone)) {
                        errors.push({
                            documento: `${nac}${cedula}`,
                            error: 'El formato del número de teléfono no es válido',
                            linea: processed
                        });
                        skipped++;
                        return;
                    }
                    
                    try {
                        // Verificar si ya existe el participante
                        const checkQuery = `
                            SELECT id FROM notif_eventos_bot.participants WHERE nac = :nac AND cedula = :cedula
                        `;
                        
                        const [existingParticipant] = await sequelize.query(checkQuery, { 
                            replacements: { nac, cedula },
                            plain: true 
                        });
                        
                        if (existingParticipant) {
                            results.push({
                                documento: `${nac}${cedula}`,
                                participanteId: existingParticipant.id,
                                mensaje: 'Participante ya registrado',
                                linea: processed
                            });
                            alreadyExists++;
                            return;
                        }
                        
                        // Insertar nuevo participante
                        const insertQuery = `
                            INSERT INTO notif_eventos_bot.participants (
                                nac,
                                cedula,
                                firstname,
                                lastname,
                                telegramid,
                                email,
                                phone,
                                organization_id,
                                user_role,
                                createdat,
                                updatedat
                            ) VALUES (
                                :nac,
                                :cedula,
                                :firstName,
                                :lastName,
                                :telegramId,
                                :email,
                                :phone,
                                :organizationId,
                                'user',
                                CURRENT_TIMESTAMP,
                                CURRENT_TIMESTAMP
                            ) RETURNING id
                        `;
                        
                        const [result] = await sequelize.query(insertQuery, { 
                            replacements: { 
                                nac, 
                                cedula, 
                                firstName, 
                                lastName, 
                                telegramId: telegramId || null, 
                                email: email || null, 
                                phone: phone || null, 
                                organizationId: organizationId || null
                            },
                            plain: true 
                        });
                        
                        results.push({
                            documento: `${nac}${cedula}`,
                            participanteId: result.id,
                            mensaje: 'Participante creado exitosamente',
                            linea: processed
                        });
                        created++;
                    } catch (error) {
                        console.error(`Error al procesar línea ${processed}:`, error);
                        errors.push({
                            documento: `${nac}${cedula}`,
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
        console.error('Error al importar participantes:', error);
        
        // Eliminar el archivo temporal si existe
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error al eliminar archivo temporal:', err);
            });
        }
        
        res.status(500).json({ error: 'Error al importar participantes', details: error.message });
    }
});

module.exports = router; 