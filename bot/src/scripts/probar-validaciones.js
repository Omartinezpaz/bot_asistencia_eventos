#!/usr/bin/env node
const axios = require('axios');

// URL del servidor
const API_URL = 'http://localhost:3006';

// Función para probar la validación de participantes
async function probarValidaciones() {
  console.log('Probando validaciones de participantes...\n');

  // Caso 1: Participante sin correo electrónico
  try {
    console.log('📋 CASO 1: Participante sin correo electrónico');
    const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, {
      nac: 'V',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      phone: '0414-123-4567'
    });
    console.log('✅ Respuesta exitosa:', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response.data);
  }
  console.log('\n');

  // Caso 2: Participante sin teléfono
  try {
    console.log('📋 CASO 2: Participante sin teléfono');
    const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, {
      nac: 'V',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com'
    });
    console.log('✅ Respuesta exitosa:', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response.data);
  }
  console.log('\n');

  // Caso 3: Participante con email inválido
  try {
    console.log('📋 CASO 3: Participante con email inválido');
    const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, {
      nac: 'V',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'emailinvalido',
      phone: '0414-123-4567'
    });
    console.log('✅ Respuesta exitosa:', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response.data);
  }
  console.log('\n');

  // Caso 4: Participante con teléfono inválido
  try {
    console.log('📋 CASO 4: Participante con teléfono inválido');
    const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, {
      nac: 'V',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
      phone: '123456'
    });
    console.log('✅ Respuesta exitosa:', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response.data);
  }
  console.log('\n');

  // Caso 5: Participante con nacionalidad inválida
  try {
    console.log('📋 CASO 5: Participante con nacionalidad inválida');
    const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, {
      nac: 'X',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
      phone: '0414-123-4567'
    });
    console.log('✅ Respuesta exitosa:', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response.data);
  }
  console.log('\n');

  // Caso 6: Participante con datos válidos
  try {
    console.log('📋 CASO 6: Participante con datos válidos');
    const respuesta = await axios.post(`${API_URL}/api/participants/validate-test`, {
      nac: 'V',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan@example.com',
      phone: '0414-123-4567'
    });
    console.log('✅ Respuesta exitosa:', respuesta.data);
  } catch (error) {
    console.log('❌ Error:', error.response.data);
  }
  console.log('\n');

  console.log('Pruebas completadas.');
}

// Ejecutar pruebas
probarValidaciones().catch(error => {
  console.error('Error al ejecutar las pruebas:', error.message);
}); 