const fs = require('fs');
const path = require('path');
const util = require('util');

// Configuración de directorios
const LOG_DIR = path.join(__dirname, 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');
const INFO_LOG_FILE = path.join(LOG_DIR, 'info.log');
const API_LOG_FILE = path.join(LOG_DIR, 'api.log');
const DEBUG_LOG_FILE = path.join(LOG_DIR, 'debug.log');

// Asegurar que el directorio de logs exista
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Función para formatear fecha para los logs
function formatDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

// Función para escribir en un archivo de log
function writeToLog(filePath, message) {
    const timestamp = formatDate();
    const formattedMessage = `[${timestamp}] ${message}\n`;
    
    fs.appendFile(filePath, formattedMessage, (err) => {
        if (err) {
            console.error(`Error al escribir en el archivo de log ${filePath}:`, err);
        }
    });
}

// Función para formatear objetos en los logs
function formatObject(obj) {
    if (obj instanceof Error) {
        return obj.stack || obj.toString();
    }
    try {
        return typeof obj === 'object' ? util.inspect(obj, { depth: 4, colors: false }) : obj;
    } catch (e) {
        return String(obj);
    }
}

// Funciones de logging
const logger = {
    error: function(...args) {
        const message = args.map(arg => formatObject(arg)).join(' ');
        console.error(`❌ [ERROR] ${message}`);
        writeToLog(ERROR_LOG_FILE, `ERROR: ${message}`);
    },
    
    info: function(...args) {
        const message = args.map(arg => formatObject(arg)).join(' ');
        console.log(`ℹ️ [INFO] ${message}`);
        writeToLog(INFO_LOG_FILE, `INFO: ${message}`);
    },
    
    api: function(...args) {
        const message = args.map(arg => formatObject(arg)).join(' ');
        console.log(`📡 [API] ${message}`);
        writeToLog(API_LOG_FILE, `API: ${message}`);
    },
    
    debug: function(...args) {
        const message = args.map(arg => formatObject(arg)).join(' ');
        console.log(`🔍 [DEBUG] ${message}`);
        writeToLog(DEBUG_LOG_FILE, `DEBUG: ${message}`);
    },
    
    db: function(...args) {
        const message = args.map(arg => formatObject(arg)).join(' ');
        console.log(`🗄️ [DB] ${message}`);
        writeToLog(API_LOG_FILE, `DB: ${message}`);
    },
    
    bot: function(...args) {
        const message = args.map(arg => formatObject(arg)).join(' ');
        console.log(`🤖 [BOT] ${message}`);
        writeToLog(INFO_LOG_FILE, `BOT: ${message}`);
    },
    
    stats: function(...args) {
        const message = args.map(arg => formatObject(arg)).join(' ');
        console.log(`📊 [STATS] ${message}`);
        writeToLog(API_LOG_FILE, `STATS: ${message}`);
    },
    
    http: function(req, res, message) {
        const logEntry = `${req.method} ${req.originalUrl} - ${res.statusCode} ${message || ''}`;
        console.log(`🌐 [HTTP] ${logEntry}`);
        writeToLog(API_LOG_FILE, `HTTP: ${logEntry}`);
    },
    
    // Función especial para registrar errores con stack trace completo
    exception: function(err, context = '') {
        const message = `${context ? context + ': ' : ''}${err.message}`;
        const stack = err.stack || 'No stack trace disponible';
        
        console.error(`❌❌ [EXCEPTION] ${message}`);
        console.error(stack);
        
        writeToLog(ERROR_LOG_FILE, `EXCEPTION: ${message}\n${stack}`);
    }
};

module.exports = logger; 