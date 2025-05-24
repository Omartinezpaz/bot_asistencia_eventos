#!/usr/bin/env node
const axios = require('axios');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Obtener el primer evento disponible
async function obtenerPrimerEvento() {
  try {
    const respuesta = await axios.get(`${API_URL}/api/events/test`);
    if (respuesta.data && respuesta.data.length > 0) {
      return respuesta.data[0];
    }
    return null;
  } catch (error) {
    console.error('Error al obtener eventos:', error.message);
    return null;
  }
}

// Función para probar validación de participante
async function probarValidacionParticipante() {
  try {
    console.log('Obteniendo evento para prueba...');
    const evento = await obtenerPrimerEvento();
    
    if (!evento) {
      console.log('❌ No se encontraron eventos disponibles para realizar pruebas');
      return;
    }
    
    console.log(`Usando evento: ${evento.name} (ID: ${evento.id})`);
    
    // Probar con algunos documentos de identidad
    const documentos = [
      { cedula: '12345678', nac: 'V' },
      { cedula: '87654321', nac: 'V' },
      { cedula: '123456', nac: 'E' }
    ];
    
    for (const doc of documentos) {
      console.log(`\n📋 Validando participante con cédula: ${doc.nac}${doc.cedula}`);
      
      try {
        const respuesta = await axios.post(`${API_URL}/api/attendances/validate-participant-test`, {
          cedula: doc.cedula,
          nac: doc.nac,
          eventId: evento.id
        });
        
        console.log('✅ Resultado de la validación:');
        
        if (respuesta.data.participante) {
          console.log(`Participante encontrado: ${respuesta.data.participante.nombreCompleto}`);
          console.log(`Documento: ${respuesta.data.participante.documento}`);
          console.log(`Email: ${respuesta.data.participante.email || 'No disponible'}`);
          console.log(`Teléfono: ${respuesta.data.participante.phone || 'No disponible'}`);
          console.log(`Faltan datos: ${respuesta.data.participante.faltanDatos ? 'Sí' : 'No'}`);
        } else {
          console.log('❌ Participante no encontrado en la base de datos');
        }
        
        if (respuesta.data.registroElectoral) {
          console.log(`Encontrado en registro electoral: ${respuesta.data.registroElectoral.nombreCompleto}`);
        }
        
        if (respuesta.data.asistencia) {
          console.log(`Ya existe asistencia con ID: ${respuesta.data.asistencia.id}`);
          console.log(`Estado: ${respuesta.data.asistencia.estado}`);
        } else {
          console.log('No existe asistencia previa para este participante en este evento');
        }
        
        console.log(`Puede registrar: ${respuesta.data.puedeRegistrar ? 'Sí' : 'No'}`);
        console.log(`Requiere crear participante: ${respuesta.data.requiereCrearParticipante ? 'Sí' : 'No'}`);
        console.log(`No encontrado: ${respuesta.data.noEncontrado ? 'Sí' : 'No'}`);
      } catch (error) {
        console.log('❌ Error al validar participante:', error.response?.data || error.message);
      }
    }
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

// Ejecutar pruebas
probarValidacionParticipante().then(() => {
  console.log('\n✅ Pruebas completadas');
}); 