#!/usr/bin/env node
const axios = require('axios');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Función para probar las notificaciones
async function probarNotificaciones() {
  console.log('Probando envío de notificaciones...\n');

  // Obtener eventos disponibles
  try {
    console.log('📋 Obteniendo eventos disponibles');
    const respuesta = await axios.get(`${API_URL}/api/events`);
    const eventos = respuesta.data;
    
    if (eventos.length === 0) {
      console.log('❌ No hay eventos disponibles para enviar notificaciones');
      return;
    }
    
    console.log(`✅ Se encontraron ${eventos.length} eventos`);
    console.log('Eventos disponibles:');
    eventos.forEach(evento => {
      console.log(`- ID: ${evento.id}, Nombre: ${evento.name}, Fecha: ${evento.date}`);
    });
    
    // Seleccionar el primer evento para probar
    const eventoId = eventos[0].id;
    console.log(`\nSeleccionando evento con ID: ${eventoId} para pruebas`);
    
    // Programar notificaciones para el evento seleccionado
    console.log('\n📋 Programando notificaciones para el evento');
    try {
      const respuestaProgramacion = await axios.post(`${API_URL}/api/notifications/schedule`, {
        eventId: eventoId
      });
      console.log('✅ Notificaciones programadas:', respuestaProgramacion.data);
    } catch (error) {
      console.log('❌ Error al programar notificaciones:', error.response?.data || error.message);
    }
    
    // Enviar notificaciones pendientes
    console.log('\n📋 Enviando notificaciones pendientes');
    try {
      const respuestaEnvio = await axios.post(`${API_URL}/api/notifications/send-pending`);
      console.log('✅ Notificaciones enviadas:', respuestaEnvio.data);
    } catch (error) {
      console.log('❌ Error al enviar notificaciones:', error.response?.data || error.message);
    }
    
    // Obtener estadísticas de notificaciones
    console.log('\n📋 Obteniendo estadísticas de notificaciones');
    try {
      const respuestaEstadisticas = await axios.get(`${API_URL}/api/notifications/stats/${eventoId}`);
      console.log('✅ Estadísticas de notificaciones:', respuestaEstadisticas.data);
    } catch (error) {
      console.log('❌ Error al obtener estadísticas:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.log('❌ Error al obtener eventos:', error.response?.data || error.message);
  }

  console.log('\nPruebas completadas.');
}

// Ejecutar pruebas
probarNotificaciones().catch(error => {
  console.error('Error al ejecutar las pruebas:', error.message);
}); 