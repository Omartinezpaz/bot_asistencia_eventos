require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Telegraf } = require('telegraf');

// Crear instancia del bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Función para registrar comandos en el bot
async function registrarComandosOrganizacion() {
  try {
    console.log('Registrando comandos de organización en el bot...');
    console.log('Token del bot:', process.env.BOT_TOKEN ? 'Disponible' : 'No disponible');
    
    // Lista de comandos a registrar
    const comandos = [
      {
        command: 'organizaciones',
        description: 'Gestionar organizaciones (solo admin)'
      },
      {
        command: 'crear_organizacion',
        description: 'Crear una nueva organización (solo admin)'
      },
      {
        command: 'mi_organizacion',
        description: 'Ver información de tu organización'
      }
    ];
    
    // Registrar los comandos en el bot
    await bot.telegram.setMyCommands(
      [...comandos],
      { scope: { type: 'default' } }
    );
    
    console.log('✅ Comandos registrados correctamente');
    
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
registrarComandosOrganizacion()
  .then(() => {
    console.log('\nProceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error en el proceso:', error);
    process.exit(1);
  }); 