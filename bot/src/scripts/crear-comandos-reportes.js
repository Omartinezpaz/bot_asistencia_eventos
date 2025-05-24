require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Telegraf } = require('telegraf');

// Crear instancia del bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Función para registrar comandos en el bot
async function registrarComandosReportes() {
  try {
    console.log('Registrando comandos de reportes en el bot...');
    console.log('Token del bot:', process.env.BOT_TOKEN ? 'Disponible' : 'No disponible');
    
    // Lista de comandos a registrar
    const comandos = [
      {
        command: 'generar_reporte',
        description: 'Generar reporte de tu organización en Excel'
      },
      {
        command: 'generar_comparativa',
        description: 'Generar comparativa entre organizaciones (solo super admin)'
      }
    ];
    
    // Obtener comandos actuales
    const comandosActuales = await bot.telegram.getMyCommands();
    
    // Filtrar comandos que ya existen para no duplicarlos
    const comandosExistentes = comandosActuales.map(cmd => cmd.command);
    const nuevosComanados = comandos.filter(cmd => !comandosExistentes.includes(cmd.command));
    
    if (nuevosComanados.length === 0) {
      console.log('✅ Todos los comandos ya están registrados');
    } else {
      // Registrar los nuevos comandos (mantener los existentes)
      await bot.telegram.setMyCommands(
        [...comandosActuales, ...nuevosComanados],
        { scope: { type: 'default' } }
      );
      
      console.log(`✅ Se han registrado ${nuevosComanados.length} nuevos comandos`);
    }
    
    // Obtener y mostrar los comandos registrados
    const comandosRegistrados = await bot.telegram.getMyCommands();
    console.log('\nComandos registrados en el bot:');
    comandosRegistrados.forEach(cmd => {
      console.log(`/${cmd.command} - ${cmd.description}`);
    });
    
  } catch (error) {
    console.error('Error al registrar comandos:', error);
  }
}

// Ejecutar la función
registrarComandosReportes()
  .then(() => {
    console.log('\nProceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error en el proceso:', error);
    process.exit(1);
  }); 