// Script para probar los endpoints de configuración
const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3006';
const ENDPOINTS = [
  '/api/settings/general',
  '/api/settings/bot',
  '/api/settings/notifications',
  '/api/settings/admins',
  '/api/settings/backups',
  '/api/settings/all'
];

// Función para probar un endpoint
async function testEndpoint(endpoint) {
  try {
    console.log(`Probando endpoint: ${endpoint}`);
    const response = await axios.get(`${BASE_URL}${endpoint}`);
    console.log(`✅ Éxito - Status: ${response.status}`);
    console.log('Respuesta:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Error - ${endpoint}:`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Detalles:', error.response.data);
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor. ¿Está la aplicación en ejecución?');
    } else {
      console.error('Error al preparar la solicitud:', error.message);
    }
    return false;
  }
}

// Función principal
async function runTests() {
  console.log('=== PRUEBA DE ENDPOINTS DE CONFIGURACIÓN ===');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const endpoint of ENDPOINTS) {
    const success = await testEndpoint(endpoint);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    console.log('-'.repeat(50));
  }
  
  console.log(`\n=== RESUMEN ===`);
  console.log(`Total de endpoints: ${ENDPOINTS.length}`);
  console.log(`Exitosos: ${successCount}`);
  console.log(`Fallidos: ${failCount}`);
}

// Ejecutar las pruebas
runTests()
  .then(() => console.log('Pruebas completadas'))
  .catch(err => console.error('Error en las pruebas:', err)); 