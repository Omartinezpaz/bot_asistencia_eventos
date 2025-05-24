require('dotenv').config();
const { startBot } = require('./src/bot');

// Iniciar el bot y el servidor web
startBot().catch(err => {
  console.error('Error general al iniciar la aplicación:', err);
  process.exit(1);
}); 