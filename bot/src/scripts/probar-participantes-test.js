#!/usr/bin/env node
const axios = require('axios');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Función para probar endpoints de participantes sin autenticación
async function probarParticipantesTest() {
  console.log('Probando endpoints de participantes sin autenticación...\n');
  
  try {
    // CASO 1: Validar participante (sin autenticación)
    console.log('📋 CASO 1: Validar participante');
    const datos = {
      nac: 'V',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juanperez@gmail.com',
      phone: '0414-123-4567'
    };
    
    try {
      const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, datos);
      console.log('✅ Validación exitosa:', respuesta.data);
    } catch (error) {
      console.log('❌ Error en validación:', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 2: Validar participante con datos inválidos
    console.log('📋 CASO 2: Validar participante con datos inválidos');
    const datosInvalidos = {
      nac: 'X', // Nacionalidad inválida
      cedula: 'ABC123', // Cédula inválida
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'correo-invalido', // Email inválido
      phone: '123456' // Teléfono inválido
    };
    
    try {
      const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, datosInvalidos);
      console.log('✅ Validación exitosa (inesperado):', respuesta.data);
    } catch (error) {
      console.log('❌ Error en validación (esperado):', error.response?.data);
    }
    console.log('\n');
    
    // CASO 3: Verificar si un participante existe por cédula
    console.log('📋 CASO 3: Verificar si un participante existe por cédula');
    
    try {
      // Primero probar si el endpoint está disponible
      console.log('Verificando disponibilidad del endpoint...');
      
      // Probar con algunas cédulas (algunas que probablemente existan y otras no)
      const cedulas = ['12345678', '87654321', '11111111', '99999999'];
      
      try {
        await axios.post(`${API_URL}/api/participants/check-participant-test`, {
          cedula: cedulas[0],
          nac: 'V'
        });
        
        // Si no hay error, el endpoint está disponible
        console.log('✅ Endpoint disponible, probando con diferentes cédulas:');
        
        for (const cedula of cedulas) {
          console.log(`\nVerificando cédula: V${cedula}`);
          
          try {
            const respuesta = await axios.post(`${API_URL}/api/participants/check-participant-test`, {
              cedula,
              nac: 'V'
            });
            
            if (respuesta.data.exists) {
              console.log('✅ Participante encontrado:');
              console.log(`- Nombre: ${respuesta.data.participant.fullName}`);
              console.log(`- Documento: ${respuesta.data.participant.documento}`);
              console.log(`- Email: ${respuesta.data.participant.email || 'No especificado'}`);
              console.log(`- Faltan datos: ${respuesta.data.faltanDatos ? 'Sí' : 'No'}`);
            } else if (respuesta.data.registroElectoral) {
              console.log('ℹ️ No existe como participante pero se encontró en el registro electoral:');
              console.log(`- Nombre: ${respuesta.data.registroElectoral.nombre} ${respuesta.data.registroElectoral.apellido}`);
              console.log(`- Se puede crear: ${respuesta.data.requiereCrearParticipante ? 'Sí' : 'No'}`);
            } else {
              console.log('❌ No se encontró ningún participante con esa cédula');
            }
          } catch (error) {
            console.log('❌ Error al verificar participante:', error.response?.data || error.message);
          }
        }
      } catch (error) {
        if (error.response?.data?.error === 'Ruta no encontrada') {
          console.log('❌ El endpoint no está disponible todavía. Necesita reiniciar el servidor después de agregar el endpoint.');
          console.log('Mensaje del servidor:', error.response.data);
        } else {
          console.log('❌ Error al verificar disponibilidad del endpoint:', error.response?.data || error.message);
        }
      }
    } catch (error) {
      console.error('Error general en CASO 3:', error.message);
    }
    
    console.log('\n✅ Pruebas completadas.');
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

// Ejecutar pruebas
probarParticipantesTest().catch(error => {
  console.error('Error al ejecutar pruebas:', error.message);
}); 