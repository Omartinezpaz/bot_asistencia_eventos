require('dotenv').config();
const { sequelize, Organizacion, Participante, Evento, Asistencia } = require('../database');

async function verificarTablas() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión establecida correctamente.');

    console.log('\n--- Estado de las tablas ---');
    
    // Verificar tabla de organizaciones
    const organizaciones = await Organizacion.findAll();
    console.log(`\nOrganizaciones (${organizaciones.length}):`);
    if (organizaciones.length > 0) {
      organizaciones.forEach(org => {
        console.log(`- ID: ${org.id}, Nombre: ${org.name}, Activa: ${org.active}`);
      });
    } else {
      console.log('No hay organizaciones registradas.');
    }

    // Verificar tabla de participantes
    const participantes = await Participante.findAll();
    console.log(`\nParticipantes (${participantes.length}):`);
    if (participantes.length > 0) {
      participantes.forEach(p => {
        console.log(`- ID: ${p.id}, Nombre: ${p.firstName} ${p.lastName}, Cédula: ${p.cedula}, Rol: ${p.rol || 'user'}, Telegram: ${p.telegramId}`);
      });
    } else {
      console.log('No hay participantes registrados.');
    }

    // Verificar tabla de eventos
    const eventos = await Evento.findAll();
    console.log(`\nEventos (${eventos.length}):`);
    if (eventos.length > 0) {
      eventos.forEach(e => {
        console.log(`- ID: ${e.id}, Nombre: ${e.name}, Fecha: ${e.date}, Activo: ${e.active}`);
      });
    } else {
      console.log('No hay eventos registrados.');
    }

    // Verificar tabla de asistencias
    const asistencias = await Asistencia.findAll();
    console.log(`\nAsistencias (${asistencias.length}):`);
    if (asistencias.length > 0) {
      asistencias.forEach(a => {
        console.log(`- ID: ${a.id}, Evento: ${a.eventid}, Participante: ${a.participantid}, Estado: ${a.status}`);
      });
    } else {
      console.log('No hay asistencias registradas.');
    }

    // Verificar esquema SQL
    const [tablas] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'notif_eventos_bot'`
    );
    
    console.log('\nTablas en el esquema notif_eventos_bot:');
    tablas.forEach(tabla => {
      console.log(`- ${tabla.table_name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error al verificar tablas:', error);
    process.exit(1);
  }
}

verificarTablas(); 