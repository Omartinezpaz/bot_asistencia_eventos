const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3006';
const PARTICIPANT_ID = '1'; // ID del participante a eliminar (usamos ID=1 que probablemente existe)
const AUTH_CREDENTIALS = {
  username: 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

// Función para obtener token de autenticación
async function getAuthToken() {
  try {
    console.log('Obteniendo token de autenticación...');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, AUTH_CREDENTIALS);
    
    if (!response.data.token) {
      throw new Error('No se recibió token de autenticación');
    }
    
    console.log('✅ Token obtenido correctamente');
    return response.data.token;
  } catch (error) {
    console.error('❌ Error al obtener token:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
    throw error;
  }
}

// Función para probar la eliminación de un participante
async function testDeleteParticipant(token) {
  try {
    console.log(`Probando eliminación del participante ID: ${PARTICIPANT_ID}`);
    
    // Headers con autenticación
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    
    // Primero verificamos si el participante existe
    console.log('1. Verificando si el participante existe...');
    try {
      const getResponse = await axios.get(`${BASE_URL}/api/participants/${PARTICIPANT_ID}`, { headers });
      console.log(`✅ Participante encontrado: ${getResponse.data.firstName} ${getResponse.data.lastName}`);
    } catch (error) {
      console.error('❌ Error al buscar el participante:', error.message);
      console.error('Detalles:', error.response?.data || 'No hay detalles disponibles');
      return false;
    }
    
    // Intentamos eliminar el participante
    console.log('2. Intentando eliminar el participante...');
    try {
      const deleteResponse = await axios.delete(`${BASE_URL}/api/participants/${PARTICIPANT_ID}`, { headers });
      console.log(`✅ Éxito - Status: ${deleteResponse.status}`);
      console.log('Respuesta:', JSON.stringify(deleteResponse.data, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error al eliminar el participante:', error.message);
      console.error('Detalles:', error.response?.data || 'No hay detalles disponibles');
      return false;
    }
  } catch (error) {
    console.error('❌ Error general:', error.message);
    return false;
  }
}

// Función principal
async function runTest() {
  console.log('=== PRUEBA DE ELIMINACIÓN DE PARTICIPANTE ===');
  
  try {
    // Paso 1: Obtener token
    const token = await getAuthToken();
    
    // Paso 2: Probar eliminación
    const success = await testDeleteParticipant(token);
    
    console.log('\n=== RESUMEN ===');
    console.log(`Resultado: ${success ? '✅ Exitoso' : '❌ Fallido'}`);
  } catch (error) {
    console.log('\n=== RESUMEN ===');
    console.log('Resultado: ❌ Fallido - Error de autenticación');
  }
}

// Ejecutar prueba
runTest()
  .then(() => console.log('Prueba completada'))
  .catch(err => console.error('Error en la prueba:', err)); 