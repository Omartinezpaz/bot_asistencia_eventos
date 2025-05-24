const express = require('express');
const router = express.Router();
const { authenticateToken, checkAdminRole } = require('../middleware/auth');
const { sequelize, Sequelize } = require('../../database');
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mkdirAsync = promisify(fs.mkdir);

// Directorio para almacenar reportes temporales
const REPORTS_DIR = path.join(__dirname, '../../../temp/reports');

// Crear directorio si no existe
async function ensureReportsDir() {
    try {
        await mkdirAsync(REPORTS_DIR, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Endpoint para generar reportes
router.get('/', authenticateToken, checkAdminRole, async (req, res) => {
    try {
        const { type, format = 'excel', organizationId, eventId, dateStart, dateEnd, includeCharts } = req.query;
        
        // Validar tipo de reporte
        if (!type) {
            return res.status(400).json({ error: 'Tipo de reporte no especificado' });
        }
        
        // Validar formato
        if (!['excel', 'csv', 'pdf'].includes(format)) {
            return res.status(400).json({ error: 'Formato de reporte no válido' });
        }
        
        // Asegurar que el directorio de reportes existe
        await ensureReportsDir();
        
        // Generar nombre de archivo único
        const timestamp = Date.now();
        const fileName = `report_${type}_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;
        const filePath = path.join(REPORTS_DIR, fileName);
        
        // Generar reporte según el tipo solicitado
        let reportData;
        
        switch (type) {
            case 'events-summary':
                reportData = await generateEventsSummary(organizationId, dateStart, dateEnd);
                break;
                
            case 'event-attendance-detail':
                if (!eventId) {
                    return res.status(400).json({ error: 'ID de evento requerido para este reporte' });
                }
                reportData = await generateEventAttendanceDetail(eventId);
                break;
                
            case 'events-by-organization':
                reportData = await generateEventsByOrganization(organizationId);
                break;
                
            case 'participants-by-organization':
                reportData = await generateParticipantsByOrganization(organizationId);
                break;
                
            case 'participant-activity':
                reportData = await generateParticipantActivity();
                break;
                
            case 'participants-without-telegram':
                reportData = await generateParticipantsWithoutTelegram(organizationId);
                break;
                
            case 'attendance-summary':
                reportData = await generateAttendanceSummary(organizationId, dateStart, dateEnd);
                break;
                
            case 'attendance-by-date':
                reportData = await generateAttendanceByDate(dateStart, dateEnd);
                break;
                
            case 'attendance-method-analysis':
                reportData = await generateAttendanceMethodAnalysis(dateStart, dateEnd);
                break;
                
            case 'notification-effectiveness':
                reportData = await generateNotificationEffectiveness(eventId, dateStart, dateEnd);
                break;
                
            case 'notification-response-time':
                reportData = await generateNotificationResponseTime(dateStart, dateEnd);
                break;
                
            case 'failed-notifications':
                reportData = await generateFailedNotifications(dateStart, dateEnd);
                break;
                
            default:
                return res.status(400).json({ error: 'Tipo de reporte no válido' });
        }
        
        // Generar archivo según el formato solicitado
        switch (format) {
            case 'excel':
                await createExcelReport(reportData, filePath);
                break;
                
            case 'csv':
                await createCsvReport(reportData, filePath);
                break;
                
            case 'pdf':
                await createPdfReport(reportData, filePath);
                break;
        }
        
        // Enviar archivo al cliente
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Error al descargar reporte:', err);
            }
            
            // Eliminar archivo después de la descarga
            setTimeout(() => {
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            }, 60000); // Eliminar después de 1 minuto
        });
    } catch (error) {
        console.error('Error al generar reporte:', error);
        res.status(500).json({ error: 'Error al generar reporte' });
    }
});

// Implementaciones de los generadores de reportes
async function generateEventsSummary(organizationId, dateStart, dateEnd) {
    let query = `
        SELECT 
            e.id,
            e.name,
            e.date,
            e.location,
            o.name as organization_name,
            COUNT(a.id) as total_attendance,
            SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_attendance,
            CASE 
                WHEN COUNT(a.id) > 0 THEN 
                    ROUND((SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END)::numeric / COUNT(a.id)::numeric) * 100, 2)
                ELSE 0
            END AS attendance_rate
        FROM events e
        LEFT JOIN organizations o ON e.organization_id = o.id
        LEFT JOIN attendances a ON e.id = a.eventid
        WHERE 1=1
    `;
    
    const replacements = {};
    
    if (organizationId) {
        query += ' AND e.organization_id = :organizationId';
        replacements.organizationId = organizationId;
    }
    
    if (dateStart && dateEnd) {
        query += ' AND e.date BETWEEN :dateStart AND :dateEnd';
        replacements.dateStart = dateStart;
        replacements.dateEnd = dateEnd;
    }
    
    query += ' GROUP BY e.id, e.name, e.date, e.location, o.name ORDER BY e.date DESC';
    
    const [results] = await sequelize.query(query, { replacements });
    
    return {
        title: 'Resumen de Eventos',
        headers: ['ID', 'Nombre', 'Fecha', 'Ubicación', 'Organización', 'Total Asistencias', 'Confirmadas', '% Asistencia'],
        data: results.map(row => [
            row.id,
            row.name,
            new Date(row.date).toLocaleString(),
            row.location || 'N/A',
            row.organization_name || 'N/A',
            row.total_attendance,
            row.confirmed_attendance,
            `${row.attendance_rate}%`
        ])
    };
}

// Implementación esqueleto para los demás reportes
async function generateEventAttendanceDetail(eventId) {
    // Consulta para obtener detalles de asistencias a un evento específico
    // Implementación básica por ahora
    return {
        title: 'Detalle de Asistencia por Evento',
        headers: ['ID', 'Participante', 'Cédula', 'Fecha Registro', 'Estado', 'Método'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateEventsByOrganization(organizationId) {
    // Implementación básica
    return {
        title: 'Eventos por Organización',
        headers: ['Organización', 'Total Eventos', 'Eventos Activos', 'Promedio Asistencia'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateParticipantsByOrganization(organizationId) {
    // Implementación básica
    return {
        title: 'Participantes por Organización',
        headers: ['Organización', 'Total Participantes', 'Con Telegram', 'Sin Telegram'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateParticipantActivity() {
    // Implementación básica
    return {
        title: 'Actividad de Participantes',
        headers: ['ID', 'Nombre', 'Organización', 'Total Eventos', 'Asistencias', '% Asistencia'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateParticipantsWithoutTelegram(organizationId) {
    // Implementación básica
    return {
        title: 'Participantes sin Conexión a Telegram',
        headers: ['ID', 'Cédula', 'Nombre', 'Apellido', 'Email', 'Teléfono', 'Organización'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateAttendanceSummary(organizationId, dateStart, dateEnd) {
    // Implementación básica
    return {
        title: 'Resumen de Asistencias',
        headers: ['Evento', 'Fecha', 'Total Asistencias', 'Confirmadas', 'Pendientes', '% Confirmación'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateAttendanceByDate(dateStart, dateEnd) {
    // Implementación básica
    return {
        title: 'Asistencias por Período',
        headers: ['Fecha', 'Evento', 'Total Asistencias', 'Confirmadas', 'Pendientes'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateAttendanceMethodAnalysis(dateStart, dateEnd) {
    // Implementación básica
    return {
        title: 'Análisis por Método de Registro',
        headers: ['Método', 'Total Asistencias', '% del Total', 'Promedio por Evento'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateNotificationEffectiveness(eventId, dateStart, dateEnd) {
    // Implementación básica
    return {
        title: 'Efectividad de Notificaciones',
        headers: ['Evento', 'Enviadas', 'Entregadas', 'Leídas', 'Respondidas', 'Tasa de Respuesta'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateNotificationResponseTime(dateStart, dateEnd) {
    // Implementación básica
    return {
        title: 'Tiempo de Respuesta a Notificaciones',
        headers: ['Evento', 'Tiempo Promedio (mins)', 'Respuesta más Rápida', 'Respuesta más Lenta'],
        data: [] // Aquí se cargarían los datos reales
    };
}

async function generateFailedNotifications(dateStart, dateEnd) {
    // Implementación básica
    return {
        title: 'Notificaciones Fallidas',
        headers: ['ID', 'Evento', 'Fecha Programada', 'Tipo', 'Error', 'Destinatarios Fallidos'],
        data: [] // Aquí se cargarían los datos reales
    };
}

// Generación de archivos en diferentes formatos
async function createExcelReport(reportData, filePath) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportData.title);
    
    // Añadir encabezados
    worksheet.addRow(reportData.headers);
    
    // Estilo para encabezados
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Añadir datos
    reportData.data.forEach(row => {
        worksheet.addRow(row);
    });
    
    // Autoajustar columnas
    worksheet.columns.forEach(column => {
        column.width = Math.max(
            12,
            Math.max(...worksheet.getColumn(column.key).values.map(v => v ? v.toString().length : 0))
        );
    });
    
    // Guardar archivo
    await workbook.xlsx.writeFile(filePath);
}

async function createCsvReport(reportData, filePath) {
    const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: reportData.headers.map((header, index) => ({
            id: `col${index}`,
            title: header
        }))
    });
    
    const records = reportData.data.map(row => {
        const record = {};
        row.forEach((value, index) => {
            record[`col${index}`] = value;
        });
        return record;
    });
    
    await csvWriter.writeRecords(records);
}

async function createPdfReport(reportData, filePath) {
    // Implementación básica de PDF
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));
    
    // Título
    doc.fontSize(16).text(reportData.title, { align: 'center' });
    doc.moveDown();
    
    // Fecha de generación
    doc.fontSize(10).text(`Generado: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown();
    
    // Simple tabla para los datos
    const table = {
        headers: reportData.headers,
        rows: reportData.data
    };
    
    // Implementación muy básica de tabla (mejorar en producción)
    const cellPadding = 5;
    const cellWidth = doc.page.width / table.headers.length - cellPadding;
    
    // Encabezados
    doc.fontSize(12).fillColor('black');
    let y = doc.y;
    
    table.headers.forEach((header, i) => {
        doc.font('Helvetica-Bold')
           .text(header, 
                 cellPadding + (i * cellWidth), 
                 y, 
                 { width: cellWidth, align: 'left' });
    });
    
    doc.moveDown();
    y = doc.y;
    
    // Filas de datos (limitado a 100 para evitar archivos enormes)
    const maxRows = Math.min(table.rows.length, 100);
    for (let i = 0; i < maxRows; i++) {
        const row = table.rows[i];
        
        let rowHeight = 0;
        row.forEach((cell, j) => {
            doc.font('Helvetica')
               .text(String(cell), 
                     cellPadding + (j * cellWidth), 
                     y, 
                     { width: cellWidth, align: 'left' });
            
            // Calcular altura de la fila
            const textHeight = doc.heightOfString(String(cell), { width: cellWidth });
            rowHeight = Math.max(rowHeight, textHeight);
        });
        
        y += rowHeight + cellPadding;
        
        // Saltar a nueva página si es necesario
        if (y > doc.page.height - 100) {
            doc.addPage();
            y = 100;
        }
    }
    
    // Si hay más filas de las que se muestran
    if (table.rows.length > maxRows) {
        doc.moveDown();
        doc.fontSize(10).text(`... y ${table.rows.length - maxRows} filas más`, { align: 'center' });
    }
    
    doc.end();
}

module.exports = router; 