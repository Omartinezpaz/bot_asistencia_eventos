#!/usr/bin/env node
const axios = require('axios');

// URL del servidor y credenciales de autenticación
const API_URL = 'http://localhost:3006';
const AUTH = {
  username: 'admin',
  password: 'admin123'
};

// Función para obtener token de autenticación
async function obtenerToken() {
  try {
    const respuesta = await axios.post(`${API_URL}/api/auth/login`, {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123' // Obtener de variable de entorno o usar valor por defecto
    });
    
    return respuesta.data.token;
  } catch (error) {
    console.error('Error al obtener token:', error.response?.data || error.message);
    throw new Error('No se pudo obtener el token de autenticación');
  }
}

// Función para probar CRUD de participantes
async function probarCRUDParticipantes() {
  console.log('Probando operaciones CRUD de participantes...\n');
  
  let token;
  try {
    token = await obtenerToken();
    console.log('✅ Token de autenticación obtenido correctamente\n');
  } catch (error) {
    console.log('❌ Error al autenticar, usando autenticación básica\n');
    // Continuamos con autenticación básica si no se puede obtener token
  }
  
  const headers = token 
    ? { Authorization: `Bearer ${token}` }
    : { Authorization: `Basic ${Buffer.from(`${AUTH.username}:${AUTH.password}`).toString('base64')}` };
  
  // CASO 1: Crear participante sin correo
  try {
    console.log('📋 CASO 1: Crear participante sin correo electrónico');
    const respuesta = await axios.post(`${API_URL}/api/participants`, {
      nac: 'V',
      cedula: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      phone: '0414-123-4567'
    }, { headers });
    console.log('✅ Respuesta exitosa (inesperado):', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response?.data || error.message);
  }
  console.log('\n');
  
  // CASO 2: Crear participante sin teléfono
  try {
    console.log('📋 CASO 2: Crear participante sin teléfono');
    const respuesta = await axios.post(`${API_URL}/api/participants`, {
      nac: 'V',
      cedula: '12345679',
      firstName: 'Ana',
      lastName: 'García',
      email: 'ana@example.com'
    }, { headers });
    console.log('✅ Respuesta exitosa (inesperado):', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response?.data || error.message);
  }
  console.log('\n');
  
  // CASO 3: Crear participante con email inválido
  try {
    console.log('📋 CASO 3: Crear participante con email inválido');
    const respuesta = await axios.post(`${API_URL}/api/participants`, {
      nac: 'V',
      cedula: '12345680',
      firstName: 'Pedro',
      lastName: 'López',
      email: 'emailinvalido',
      phone: '0414-123-4567'
    }, { headers });
    console.log('✅ Respuesta exitosa (inesperado):', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response?.data || error.message);
  }
  console.log('\n');
  
  // CASO 4: Crear participante con teléfono inválido
  try {
    console.log('📋 CASO 4: Crear participante con teléfono inválido');
    const respuesta = await axios.post(`${API_URL}/api/participants`, {
      nac: 'V',
      cedula: '12345681',
      firstName: 'María',
      lastName: 'Rodríguez',
      email: 'maria@example.com',
      phone: '123456'
    }, { headers });
    console.log('✅ Respuesta exitosa (inesperado):', respuesta.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response?.data || error.message);
  }
  console.log('\n');
  
  // CASO 5: Crear participante válido
  let participanteId;
  try {
    console.log('📋 CASO 5: Crear participante con datos válidos');
    const respuesta = await axios.post(`${API_URL}/api/participants`, {
      nac: 'V',
      cedula: '12345682',
      firstName: 'Carlos',
      lastName: 'Martínez',
      email: 'carlos@example.com',
      phone: '0414-123-4567'
    }, { headers });
    console.log('✅ Participante creado exitosamente:', respuesta.data);
    participanteId = respuesta.data.id;
  } catch (error) {
    console.log('❌ Error al crear participante válido:', error.response?.data || error.message);
  }
  console.log('\n');
  
  // Si tenemos un ID de participante, probar actualizaciones
  if (participanteId) {
    // CASO 6: Actualizar participante sin email
    try {
      console.log('📋 CASO 6: Actualizar participante sin email');
      const respuesta = await axios.put(`${API_URL}/api/participants/${participanteId}`, {
        nac: 'V',
        cedula: '12345682',
        firstName: 'Carlos',
        lastName: 'Martínez Actualizado',
        phone: '0414-123-4567'
      }, { headers });
      console.log('✅ Respuesta exitosa (inesperado):', respuesta.data);
    } catch (error) {
      console.log('❌ Error (esperado):', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 7: Actualizar participante sin teléfono
    try {
      console.log('📋 CASO 7: Actualizar participante sin teléfono');
      const respuesta = await axios.put(`${API_URL}/api/participants/${participanteId}`, {
        nac: 'V',
        cedula: '12345682',
        firstName: 'Carlos',
        lastName: 'Martínez',
        email: 'carlos@example.com'
      }, { headers });
      console.log('✅ Respuesta exitosa (inesperado):', respuesta.data);
    } catch (error) {
      console.log('❌ Error (esperado):', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 8: Actualizar participante con datos válidos
    try {
      console.log('📋 CASO 8: Actualizar participante con datos válidos');
      const respuesta = await axios.put(`${API_URL}/api/participants/${participanteId}`, {
        nac: 'V',
        cedula: '12345682',
        firstName: 'Carlos',
        lastName: 'Martínez Actualizado',
        email: 'carlos.actualizado@example.com',
        phone: '0424-765-4321'
      }, { headers });
      console.log('✅ Participante actualizado exitosamente:', respuesta.data);
    } catch (error) {
      console.log('❌ Error al actualizar participante:', error.response?.data || error.message);
    }
    console.log('\n');
    
    // CASO 9: Eliminar participante
    try {
      console.log('📋 CASO 9: Eliminar participante');
      const respuesta = await axios.delete(`${API_URL}/api/participants/${participanteId}`, { headers });
      console.log('✅ Participante eliminado exitosamente:', respuesta.data);
    } catch (error) {
      console.log('❌ Error al eliminar participante:', error.response?.data || error.message);
    }
  }
  
  console.log('\nPruebas completadas.');
}

// Ejecutar pruebas
probarCRUDParticipantes().catch(error => {
  console.error('Error general al ejecutar las pruebas:', error.message);
}); 