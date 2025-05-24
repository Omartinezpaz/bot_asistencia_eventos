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
        cb(null, `import-organizations-${Date.now()}-${file.originalname}`);
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

// Obtener lista de organizaciones
router.get('/', authenticateToken, async (req, res) => {
    try {
        const searchTerm = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                o.id,
                o.name,
                o.description,
                o.is_active,
                o.contact_email,
                o.contact_phone,
                (SELECT COUNT(*) FROM participants p WHERE p.organization_id = o.id) as participants_count
            FROM organizations o
            WHERE 1=1
        `;
        
        const replacements = {};
        
        // Añadir condición de búsqueda si existe
        if (searchTerm) {
            query += ` AND (
                o.name ILIKE :searchTerm OR 
                o.description ILIKE :searchTerm OR
                o.contact_email ILIKE :searchTerm
            )`;
            replacements.searchTerm = `%${searchTerm}%`;
        }
        
        // Añadir ordenamiento
        query += ` ORDER BY o.name`;
        
        // Consulta para contar el total de registros (para paginación)
        const countQuery = `
            SELECT COUNT(*) FROM (${query}) as subquery
        `;
        
        // Añadir paginación si se especificaron parámetros
        if (page && limit) {
            query += ` LIMIT :limit OFFSET :offset`;
            replacements.limit = limit;
            replacements.offset = offset;
        }
        
        // Ejecutar las consultas
        const [organizations] = await sequelize.query(query, { replacements });
        
        // Si hay paginación, obtenemos el conteo total
        if (page && limit) {
            const [countResult] = await sequelize.query(countQuery, { replacements, plain: true });
            const totalItems = parseInt(countResult.count);
            const totalPages = Math.ceil(totalItems / limit);
            
            return res.json({
                items: organizations,
                pagination: {
                    page,
                    limit,
                    totalItems,
                    totalPages
                }
            });
        }
        
        // Si no hay paginación, solo devolvemos el array de organizaciones
        res.json(organizations);
    } catch (error) {
        console.error('Error al obtener organizaciones:', error);
        res.status(500).json({ error: 'Error al obtener organizaciones' });
    }
});

// Obtener detalle de una organización
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const organizationId = req.params.id;
        
        const query = `
            SELECT 
                o.id,
                o.name,
                o.description,
                o.is_active,
                o.contact_email,
                o.contact_phone,
                (SELECT COUNT(*) FROM participants p WHERE p.organization_id = o.id) as participants_count,
                (SELECT COUNT(*) FROM events e WHERE e.organization_id = o.id) as events_count
            FROM organizations o
            WHERE o.id = :organizationId
        `;
        
        const [organization] = await sequelize.query(query, { 
            replacements: { organizationId },
            plain: true 
        });
        
        if (!organization) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }
        
        res.json(organization);
    } catch (error) {
        console.error('Error al obtener detalles de la organización:', error);
        res.status(500).json({ error: 'Error al obtener detalles de la organización' });
    }
});

// Crear una nueva organización
router.post('/', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { name, description, contactEmail, contactPhone, isActive = true } = req.body;
        
        // Validar datos obligatorios
        if (!name) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        
        // Verificar si ya existe una organización con el mismo nombre
        const checkQuery = `
            SELECT id FROM organizations WHERE LOWER(name) = LOWER(:name)
        `;
        
        const [existingOrg] = await sequelize.query(checkQuery, { 
            replacements: { name },
            plain: true 
        });
        
        if (existingOrg) {
            return res.status(400).json({ error: 'Ya existe una organización con ese nombre' });
        }
        
        // Insertar nueva organización
        const insertQuery = `
            INSERT INTO organizations (
                name, 
                description, 
                contact_email, 
                contact_phone, 
                is_active,
                created_at,
                updated_at
            ) VALUES (
                :name, 
                :description, 
                :contactEmail, 
                :contactPhone, 
                :isActive,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            ) RETURNING id
        `;
        
        const [result] = await sequelize.query(insertQuery, { 
            replacements: { 
                name, 
                description: description || null, 
                contactEmail: contactEmail || null, 
                contactPhone: contactPhone || null, 
                isActive
            },
            plain: true 
        });
        
        res.status(201).json({
            id: result.id,
            name,
            description,
            contactEmail,
            contactPhone,
            isActive,
            created: true
        });
    } catch (error) {
        console.error('Error al crear organización:', error);
        res.status(500).json({ error: 'Error al crear organización', details: error.message });
    }
});

// Actualizar una organización existente
router.put('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const organizationId = req.params.id;
        const { name, description, contactEmail, contactPhone, isActive } = req.body;
        
        // Validar datos obligatorios
        if (!name) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        
        // Verificar si la organización existe
        const checkQuery = `SELECT id FROM organizations WHERE id = :organizationId`;
        const [existingOrg] = await sequelize.query(checkQuery, { 
            replacements: { organizationId },
            plain: true 
        });
        
        if (!existingOrg) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }
        
        // Verificar si el nuevo nombre ya existe (excepto si es la misma organización)
        const checkNameQuery = `
            SELECT id FROM organizations WHERE LOWER(name) = LOWER(:name) AND id != :organizationId
        `;
        
        const [duplicateOrg] = await sequelize.query(checkNameQuery, { 
            replacements: { name, organizationId },
            plain: true 
        });
        
        if (duplicateOrg) {
            return res.status(400).json({ error: 'Ya existe otra organización con ese nombre' });
        }
        
        // Actualizar organización
        const updateQuery = `
            UPDATE organizations SET
                name = :name,
                description = :description,
                contact_email = :contactEmail,
                contact_phone = :contactPhone,
                is_active = :isActive,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :organizationId
        `;
        
        await sequelize.query(updateQuery, { 
            replacements: { 
                organizationId,
                name, 
                description: description || null, 
                contactEmail: contactEmail || null, 
                contactPhone: contactPhone || null, 
                isActive: isActive !== undefined ? isActive : true
            }
        });
        
        res.json({
            id: organizationId,
            name,
            description,
            contactEmail,
            contactPhone,
            isActive,
            updated: true
        });
    } catch (error) {
        console.error('Error al actualizar organización:', error);
        res.status(500).json({ error: 'Error al actualizar organización' });
    }
});

// Cambiar estado de una organización (activar/desactivar)
router.patch('/:id/toggle-status', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const organizationId = req.params.id;
        const { active } = req.body;
        
        if (active === undefined) {
            return res.status(400).json({ error: 'Se requiere el parámetro active' });
        }
        
        // Verificar si la organización existe
        const checkQuery = `SELECT id FROM organizations WHERE id = :organizationId`;
        const [existingOrg] = await sequelize.query(checkQuery, { 
            replacements: { organizationId },
            plain: true 
        });
        
        if (!existingOrg) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }
        
        // Actualizar estado
        const updateQuery = `
            UPDATE organizations SET
                is_active = :active,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :organizationId
        `;
        
        await sequelize.query(updateQuery, { 
            replacements: { organizationId, active }
        });
        
        res.json({
            id: organizationId,
            active,
            updated: true
        });
    } catch (error) {
        console.error('Error al cambiar estado de la organización:', error);
        res.status(500).json({ error: 'Error al cambiar estado de la organización' });
    }
});

// Obtener lista de organizaciones para selects
router.get('/list/dropdown', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT id, name 
            FROM organizations 
            WHERE is_active = true 
            ORDER BY name
        `;
        
        const [organizations] = await sequelize.query(query);
        
        res.json(organizations);
    } catch (error) {
        console.error('Error al obtener lista de organizaciones:', error);
        res.status(500).json({ error: 'Error al obtener lista de organizaciones' });
    }
});

// Eliminar una organización
router.delete('/:id', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const organizationId = req.params.id;
        
        // Verificar si la organización existe
        const checkQuery = `SELECT id FROM organizations WHERE id = :organizationId`;
        const [existingOrg] = await sequelize.query(checkQuery, { 
            replacements: { organizationId },
            plain: true 
        });
        
        if (!existingOrg) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }
        
        // Verificar referencias en participantes
        const checkParticipantsQuery = `
            SELECT COUNT(*) as count FROM participants WHERE organization_id = :organizationId
        `;
        
        const [participantsResult] = await sequelize.query(checkParticipantsQuery, { 
            replacements: { organizationId },
            plain: true 
        });
        
        if (participantsResult.count > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar la organización porque tiene participantes asociados',
                count: participantsResult.count
            });
        }
        
        // Verificar referencias en eventos
        const checkEventsQuery = `
            SELECT COUNT(*) as count FROM events WHERE organization_id = :organizationId
        `;
        
        const [eventsResult] = await sequelize.query(checkEventsQuery, { 
            replacements: { organizationId },
            plain: true 
        });
        
        if (eventsResult.count > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar la organización porque tiene eventos asociados',
                count: eventsResult.count
            });
        }
        
        // Eliminar organización
        const deleteQuery = `DELETE FROM organizations WHERE id = :organizationId`;
        await sequelize.query(deleteQuery, { replacements: { organizationId } });
        
        res.json({
            id: organizationId,
            deleted: true
        });
    } catch (error) {
        console.error('Error al eliminar organización:', error);
        res.status(500).json({ error: 'Error al eliminar organización' });
    }
});

// Endpoint para obtener organizaciones sin autenticación (solo para pruebas)
router.get('/test', async (req, res) => {
    try {
        const query = `
            SELECT 
                o.id,
                o.name,
                o.description,
                o.is_active,
                o.contact_email,
                o.contact_phone,
                (SELECT COUNT(*) FROM notif_eventos_bot.participants p WHERE p.organization_id = o.id) as participants_count
            FROM notif_eventos_bot.organizations o
            WHERE o.is_active = true
            ORDER BY o.name
            LIMIT 10
        `;
        
        const [organizations] = await sequelize.query(query);
        
        res.json(organizations);
    } catch (error) {
        console.error('Error al obtener organizaciones para pruebas:', error);
        res.status(500).json({ error: 'Error al obtener organizaciones' });
    }
});

// Agregar endpoint para importar organizaciones desde CSV
router.post('/import', authenticateToken, checkAdminRole, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
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
                    
                    // Campos esperados: nombre, descripcion, email, telefono, activo
                    const name = data.nombre || data.name || '';
                    const description = data.descripcion || data.description || '';
                    const contactEmail = data.email || data.contact_email || data.correo || '';
                    const contactPhone = data.telefono || data.phone || data.contact_phone || '';
                    const isActive = (data.activo || data.active || 'true').toLowerCase() === 'true';
                    
                    // Validar datos obligatorios
                    if (!name) {
                        errors.push({
                            nombre: name || 'Fila ' + processed,
                            error: 'El nombre de la organización es obligatorio',
                            linea: processed
                        });
                        skipped++;
                        return;
                    }
                    
                    try {
                        // Verificar si ya existe una organización con el mismo nombre
                        const checkQuery = `
                            SELECT id FROM organizations WHERE LOWER(name) = LOWER(:name)
                        `;
                        
                        const [existingOrg] = await sequelize.query(checkQuery, { 
                            replacements: { name },
                            plain: true 
                        });
                        
                        if (existingOrg) {
                            results.push({
                                nombre: name,
                                organizacionId: existingOrg.id,
                                mensaje: 'Organización ya registrada',
                                linea: processed
                            });
                            alreadyExists++;
                            return;
                        }
                        
                        // Insertar nueva organización
                        const insertQuery = `
                            INSERT INTO organizations (
                                name, 
                                description, 
                                contact_email, 
                                contact_phone, 
                                is_active,
                                created_at,
                                updated_at
                            ) VALUES (
                                :name, 
                                :description, 
                                :contactEmail, 
                                :contactPhone, 
                                :isActive,
                                CURRENT_TIMESTAMP,
                                CURRENT_TIMESTAMP
                            ) RETURNING id
                        `;
                        
                        const [result] = await sequelize.query(insertQuery, { 
                            replacements: { 
                                name, 
                                description, 
                                contactEmail, 
                                contactPhone, 
                                isActive
                            },
                            plain: true 
                        });
                        
                        results.push({
                            nombre: name,
                            organizacionId: result.id,
                            mensaje: 'Organización creada exitosamente',
                            linea: processed
                        });
                        created++;
                    } catch (error) {
                        console.error(`Error al procesar línea ${processed}:`, error);
                        errors.push({
                            nombre: name || 'Fila ' + processed,
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
        console.error('Error al importar organizaciones:', error);
        
        // Eliminar el archivo temporal si existe
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error al eliminar archivo temporal:', err);
            });
        }
        
        res.status(500).json({ error: 'Error al importar organizaciones', details: error.message });
    }
});

module.exports = router; 