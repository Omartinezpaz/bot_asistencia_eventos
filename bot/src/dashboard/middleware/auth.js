const jwt = require('jsonwebtoken');

// Clave secreta para JWT
const JWT_SECRET = process.env.JWT_SECRET || 'secreto-temporal-cambiar-en-produccion';

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    // Verificar token en headers o query params (para descargas)
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    // Si no hay token en headers, verificar en query params (para descargas directas)
    if (!token && req.query.token) {
        token = req.query.token;
    }
    
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

module.exports = {
    authenticateToken,
    checkAdminRole
}; 