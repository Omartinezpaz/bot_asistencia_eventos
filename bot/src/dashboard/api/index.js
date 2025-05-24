const express = require('express');
const router = express.Router();

// Importar rutas de diferentes módulos
const reportsRoutes = require('./reports');
const settingsRoutes = require('./settings');
const attendancesRoutes = require('./attendances');
const eventsRoutes = require('./events');
const organizationsRoutes = require('./organizations');
const participantsRoutes = require('./participants');
const dbTestRoutes = require('./db-test');
const statsRoutes = require('./stats');
const notificationsRoutes = require('./notifications');

// Mostrar rutas registradas para depuración
console.log('🔍 [DEBUG] Registrando rutas API detalladas:');
console.log('- /api/settings/general (GET y POST)');
console.log('- /api/settings/bot (GET y POST)');
console.log('- /api/settings/notifications (GET y POST)');
console.log('- /api/settings/admins (GET y POST)');
console.log('- /api/settings/backups (GET y POST)');
console.log('- /api/settings/admin-users (GET)');
console.log('- /api/notifications (GET, POST, PUT, DELETE)');
console.log('- /api/notifications/schedule (POST)');
console.log('- /api/notifications/send-pending (POST)');
console.log('- /api/notifications/stats/:eventId (GET)');

// Configurar rutas
router.use('/reports', reportsRoutes);
router.use('/settings', settingsRoutes);
router.use('/attendances', attendancesRoutes);
router.use('/events', eventsRoutes);
router.use('/organizations', organizationsRoutes);
router.use('/participants', participantsRoutes);
router.use('/db-test', dbTestRoutes);
router.use('/stats', statsRoutes);
router.use('/notifications', notificationsRoutes);

// Ruta para prueba de API
router.get('/test', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

// Exportar el router
module.exports = router; 